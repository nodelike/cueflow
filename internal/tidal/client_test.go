package tidal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

type memoryStore struct {
	token Token
	err   error
}

func (m *memoryStore) Load() (Token, error)   { return m.token, m.err }
func (m *memoryStore) Save(token Token) error { m.token = token; m.err = nil; return nil }

func TestOAuthPKCEExchangeAndRefresh(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		if request.URL.Path != "/oauth2/token" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
		_ = request.ParseForm()
		if request.Form.Get("client_secret") != "" {
			t.Fatal("desktop PKCE flow must not send a client secret")
		}
		switch request.Form.Get("grant_type") {
		case "authorization_code":
			if request.Form.Get("code_verifier") == "" || request.Form.Get("client_id") != "client" {
				t.Fatal("missing PKCE exchange values")
			}
			_ = json.NewEncoder(writer).Encode(Token{AccessToken: "access", RefreshToken: "refresh", Scope: defaultScopes, ExpiresIn: 3600})
		case "refresh_token":
			if request.Form.Get("refresh_token") != "refresh" || request.Form.Get("scope") != defaultScopes {
				t.Fatal("missing refresh values")
			}
			_ = json.NewEncoder(writer).Encode(Token{AccessToken: "fresh", ExpiresIn: 3600})
		default:
			t.Fatalf("unexpected grant type %q", request.Form.Get("grant_type"))
		}
	}))
	defer server.Close()

	oauth := OAuth{ClientID: "client", RedirectURI: "http://127.0.0.1:3000/api/source/tidal/callback", LoginBase: server.URL, TokenBase: server.URL, HTTPClient: server.Client()}
	begin, err := oauth.Begin()
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(begin.URL)
	if parsed.Query().Get("code_challenge_method") != "S256" || parsed.Query().Get("scope") != defaultScopes || begin.State == "" || begin.Verifier == "" {
		t.Fatal("PKCE authorization is incomplete")
	}
	token, err := oauth.Exchange(context.Background(), "code", begin.Verifier)
	if err != nil {
		t.Fatal(err)
	}
	if token.AccessToken != "access" || token.ExpiresAt.Before(time.Now()) {
		t.Fatal("token exchange result is incomplete")
	}
	refreshed, err := oauth.Refresh(context.Background(), token.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.AccessToken != "fresh" || refreshed.RefreshToken != "refresh" || requests != 2 {
		t.Fatalf("unexpected refresh result: %#v", refreshed)
	}
}

func TestCapabilityProbeCreatesReadsAndDeletesTemporaryPlaylist(t *testing.T) {
	calls := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls = append(calls, request.Method+" "+request.URL.Path)
		if request.Header.Get("Authorization") != "Bearer access" || request.Header.Get("Accept") != "application/vnd.api+json" {
			t.Fatal("missing TIDAL JSON:API headers")
		}
		switch request.Method + " " + request.URL.Path {
		case "POST /playlists":
			if request.Header.Get("Idempotency-Key") == "" {
				t.Fatal("create request has no idempotency key")
			}
			payload, _ := io.ReadAll(request.Body)
			if !strings.Contains(string(payload), `"accessType":"UNLISTED"`) || !strings.Contains(string(payload), probePrefix) {
				t.Fatalf("unsafe create payload: %s", payload)
			}
			writer.WriteHeader(http.StatusCreated)
			writer.Write([]byte(`{"data":{"type":"playlists","id":"probe-id","attributes":{"name":"Cueflow Capability Check — test","description":"temporary","accessType":"UNLISTED"}}}`))
		case "GET /playlists/probe-id":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"probe-id","attributes":{"name":"Cueflow Capability Check — test","description":"temporary","accessType":"UNLISTED"}}}`))
		case "DELETE /playlists/probe-id":
			if request.Header.Get("Idempotency-Key") == "" {
				t.Fatal("delete request has no idempotency key")
			}
			writer.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", Scope: "playlists.write playlists.read", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	report, err := client.ProbeCapabilities(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if !report.CreatePlaylist || !report.ReadPlaylist || !report.DeletePlaylist || report.AddPlaylistItem || report.ProbePlaylistID != "" {
		t.Fatalf("unexpected capability report: %#v", report)
	}
	want := []string{"POST /playlists", "GET /playlists/probe-id", "GET /playlists/probe-id", "DELETE /playlists/probe-id"}
	if strings.Join(calls, ",") != strings.Join(want, ",") {
		t.Fatalf("unexpected calls: %#v", calls)
	}
}

func TestClientRefusesToModifyOrDeletePermanentPlaylist(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			t.Fatalf("unsafe mutation reached TIDAL: %s %s", request.Method, request.URL.Path)
		}
		writer.Write([]byte(`{"data":{"type":"playlists","id":"permanent","attributes":{"name":"My Permanent Crate"}}}`))
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	if err := client.AddPlaylistItems(context.Background(), "permanent", []string{"track"}, ""); err == nil {
		t.Fatal("unsafe item add was accepted")
	}
	if err := client.DeletePlaylist(context.Background(), "permanent"); err == nil {
		t.Fatal("unsafe delete was accepted")
	}
	if _, err := client.CreatePlaylist(context.Background(), "My Permanent Crate", ""); err == nil {
		t.Fatal("unsafe create name was accepted")
	}
}

func TestCreateSavedSetFillsPlaylistButPublicDeleteRefusesIt(t *testing.T) {
	deleted := false
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.Method + " " + request.URL.Path {
		case "POST /playlists":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"saved","attributes":{"name":"Cueflow Set — Night A"}}}`))
		case "GET /playlists/saved":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"saved","attributes":{"name":"Cueflow Set — Night A"}}}`))
		case "POST /playlists/saved/relationships/items":
			writer.Write([]byte(`{"data":[]}`))
		case "DELETE /playlists/saved":
			deleted = true
			writer.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	playlist, err := client.CreateSavedSet(context.Background(), "Cueflow Set — Night A", "permanent", []string{"track"})
	if err != nil || playlist.ID != "saved" {
		t.Fatalf("create saved set: %#v err=%v", playlist, err)
	}
	if err := client.DeletePlaylist(context.Background(), playlist.ID); err == nil {
		t.Fatal("public deletion accepted a permanent set")
	}
	if deleted {
		t.Fatal("permanent set reached the TIDAL delete endpoint")
	}
}

func TestCreateSavedSetCleansUpIncompletePlaylist(t *testing.T) {
	deleted := false
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.Method + " " + request.URL.Path {
		case "POST /playlists":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"incomplete","attributes":{"name":"Cueflow Set — Broken"}}}`))
		case "GET /playlists/incomplete":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"incomplete","attributes":{"name":"Cueflow Set — Broken"}}}`))
		case "POST /playlists/incomplete/relationships/items":
			http.Error(writer, "failed", http.StatusBadGateway)
		case "DELETE /playlists/incomplete":
			deleted = true
			writer.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	if _, err := client.CreateSavedSet(context.Background(), "Cueflow Set — Broken", "permanent", []string{"track"}); err == nil {
		t.Fatal("failed item fill was accepted")
	}
	if !deleted {
		t.Fatal("incomplete permanent playlist was not cleaned up")
	}
}

func TestStatusHandlesMissingToken(t *testing.T) {
	client := &Client{ClientID: "client", Store: &memoryStore{err: errors.New("missing")}}
	status := client.Status()
	if !status.Configured || status.Connected || len(status.GrantedScopes) != 0 {
		t.Fatalf("unexpected status: %#v", status)
	}
}

func TestTrackIDsByISRCUsesExactCatalogFilter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/tracks" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
		values := request.URL.Query()["filter[isrc]"]
		if strings.Join(values, ",") != "ISRCONE,ISRCTWO" {
			t.Fatalf("unexpected ISRC filters: %#v", values)
		}
		writer.Write([]byte(`{"data":[{"type":"tracks","id":"tidal-one","attributes":{"isrc":"ISRCONE","title":"One"}},{"type":"tracks","id":"tidal-two","attributes":{"isrc":"ISRCTWO","title":"Two"}}]}`))
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	identities, err := client.TrackIDsByISRC(context.Background(), []string{"ISRCONE", "ISRCTWO"})
	if err != nil {
		t.Fatal(err)
	}
	if identities["ISRCONE"].ID != "tidal-one" || identities["ISRCTWO"].ID != "tidal-two" {
		t.Fatalf("unexpected identities: %#v", identities)
	}
}

func TestAddPlaylistItemsAppendsInTidalBatches(t *testing.T) {
	addCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.Method + " " + request.URL.Path {
		case "GET /playlists/preview":
			writer.Write([]byte(`{"data":{"type":"playlists","id":"preview","attributes":{"name":"Cueflow Preview — Session A"}}}`))
		case "POST /playlists/preview/relationships/items":
			addCalls++
			payload, _ := io.ReadAll(request.Body)
			if strings.Contains(string(payload), `"positionBefore"`) || request.Header.Get("Idempotency-Key") == "" {
				t.Fatalf("invalid add request: %s", payload)
			}
			writer.Write([]byte(`{"data":[]}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{ClientID: "client", Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	ids := make([]string, 51)
	for index := range ids {
		ids[index] = fmt.Sprintf("track-%d", index)
	}
	if err := client.AddPlaylistItems(context.Background(), "preview", ids, ""); err != nil {
		t.Fatal(err)
	}
	if addCalls != 2 {
		t.Fatalf("expected two TIDAL batches, got %d", addCalls)
	}
}
