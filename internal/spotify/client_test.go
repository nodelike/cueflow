package spotify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

type memoryStore struct{ token Token }

func (m *memoryStore) Load() (Token, error)   { return m.token, nil }
func (m *memoryStore) Save(token Token) error { m.token = token; return nil }

func TestOAuthPKCEAndExchange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/token" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
		_ = request.ParseForm()
		if request.Form.Get("code_verifier") == "" || request.Form.Get("client_id") != "client" {
			t.Fatal("missing PKCE exchange values")
		}
		_ = json.NewEncoder(writer).Encode(Token{AccessToken: "access", RefreshToken: "refresh", ExpiresIn: 3600})
	}))
	defer server.Close()
	oauth := OAuth{ClientID: "client", RedirectURI: "http://127.0.0.1/callback", AccountsBase: server.URL}
	begin, err := oauth.Begin()
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(begin.URL)
	if parsed.Query().Get("code_challenge_method") != "S256" || begin.State == "" || begin.Verifier == "" {
		t.Fatal("PKCE authorization is incomplete")
	}
	token, err := oauth.Exchange(context.Background(), "code", begin.Verifier)
	if err != nil {
		t.Fatal(err)
	}
	if token.AccessToken != "access" || token.ExpiresAt.Before(time.Now()) {
		t.Fatal("token exchange result is incomplete")
	}
}

func TestPlaylistPaginationAndTokenRefresh(t *testing.T) {
	pageCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/api/token":
			_ = json.NewEncoder(writer).Encode(Token{AccessToken: "fresh", ExpiresIn: 3600})
		case "/me/playlists":
			if request.URL.Query().Get("offset") == "0" {
				writer.Write([]byte(`{"items":[{"id":"list","name":"Afro Vibezz","images":[{"url":"https://image.test/large"},{"url":"https://image.test/small"}],"items":{"total":2}}],"next":"","total":1}`))
			}
		case "/playlists/list/items":
			if request.Header.Get("Authorization") != "Bearer fresh" {
				t.Fatalf("unexpected authorization header")
			}
			pageCalls++
			offset := request.URL.Query().Get("offset")
			if offset == "0" {
				writer.Write([]byte(`{"items":[{"added_at":"2026-08-10T12:00:00Z","item":{"id":"a","uri":"spotify:track:a","name":"One","type":"track","duration_ms":300000,"artists":[{"name":"A"}],"album":{"images":[{"url":"https://album.test/large"},{"url":"https://album.test/small"}]}}}],"next":"next","total":2}`))
			} else {
				writer.Write([]byte(`{"items":[{"added_at":"2026-08-11T12:00:00Z","item":{"id":"b","uri":"spotify:track:b","name":"Two","type":"track","duration_ms":300000,"artists":[{"name":"B"}]}}],"next":"","total":2}`))
			}
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	store := &memoryStore{token: Token{RefreshToken: "refresh", ExpiresAt: time.Now().Add(-time.Hour)}}
	client := &Client{Store: store, APIBase: server.URL, OAuth: OAuth{ClientID: "client", AccountsBase: server.URL}, HTTPClient: server.Client()}
	playlists, err := client.CurrentUserPlaylists(context.Background())
	if err != nil || len(playlists) != 1 || playlists[0].ImageURL != "https://image.test/small" || playlists[0].TrackCount != 2 {
		t.Fatalf("playlist catalog mapping failed: %#v %v", playlists, err)
	}
	items, err := client.PlaylistItems(context.Background(), Playlist{ID: "list", Name: "Afro Vibezz"})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 || pageCalls != 2 || store.token.AccessToken != "fresh" {
		t.Fatalf("pagination or refresh failed")
	}
	track := items[0].DomainTrack()
	if track.Artist != "A" || track.AlbumImageURL != "https://album.test/small" || !track.FeatureNeedsReview || !strings.HasPrefix(track.ID, "spotify-") {
		t.Fatal("synced track mapping is unsafe")
	}
}

func TestPublishSetRejectsUnsafeTargetsAndOnlyAppends(t *testing.T) {
	calls := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls = append(calls, request.Method+" "+request.URL.Path)
		switch request.URL.Path {
		case "/me/playlists":
			if request.Method != http.MethodPost {
				t.Fatalf("unexpected create method")
			}
			writer.Write([]byte(`{"id":"draft-playlist","name":"Set Lab — Night A"}`))
		case "/playlists/draft-playlist/items":
			if request.Method != http.MethodPost {
				t.Fatalf("publishing must append, got %s", request.Method)
			}
			writer.Write([]byte(`{"snapshot_id":"snapshot"}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	store := &memoryStore{token: Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: time.Now().Add(time.Hour)}}
	client := &Client{Store: store, APIBase: server.URL, HTTPClient: server.Client()}
	if _, err := client.PublishSet(context.Background(), "Techno Vibezz", []string{"spotify:track:a"}); err == nil {
		t.Fatal("unsafe permanent-playlist name was accepted")
	}
	if len(calls) != 0 {
		t.Fatal("unsafe publish reached Spotify")
	}
	playlist, err := client.PublishSet(context.Background(), "Set Lab — Night A", []string{"spotify:track:a", "spotify:track:b"})
	if err != nil {
		t.Fatal(err)
	}
	if playlist.ID != "draft-playlist" || len(calls) != 2 {
		t.Fatalf("safe publish failed: %#v %#v", playlist, calls)
	}
	for _, call := range calls {
		if strings.HasPrefix(call, "DELETE ") || strings.HasPrefix(call, "PUT ") {
			t.Fatalf("destructive Spotify call: %s", call)
		}
	}
}
