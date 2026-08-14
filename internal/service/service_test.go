package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/nodelike/cueflow/internal/domain"
	"github.com/nodelike/cueflow/internal/spotify"
	"github.com/nodelike/cueflow/internal/store"
	"github.com/nodelike/cueflow/internal/tidal"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type spotifyTokenStore struct{ token spotify.Token }

func (s spotifyTokenStore) Load() (spotify.Token, error) { return s.token, nil }
func (s spotifyTokenStore) Save(spotify.Token) error     { return nil }

type tidalTokenStore struct{ token tidal.Token }

func (s tidalTokenStore) Load() (tidal.Token, error) { return s.token, nil }
func (s tidalTokenStore) Save(tidal.Token) error     { return nil }

func TestSeedRejectsSyncedSpotifyCatalog(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration test")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()

	schema := "cueflow_service_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`) }()

	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	repository, err := store.Open(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer repository.Close()
	if err := repository.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := repository.SyncPlaylist(ctx, spotify.Playlist{ID: "real-crate", Name: "Real crate", Kind: "source"}, nil); err != nil {
		t.Fatal(err)
	}

	err = New(repository).Seed(ctx)
	if err == nil || !strings.Contains(err.Error(), "cannot be added") {
		t.Fatalf("reference fixtures were accepted after Spotify sync: %v", err)
	}
	trackCount, _, err := repository.Count(ctx)
	if err != nil || trackCount != 0 {
		t.Fatalf("rejected seed changed the catalog: tracks=%d err=%v", trackCount, err)
	}
}

func TestPermanentTidalSetSurvivesPreviewReplacement(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for PostgreSQL integration test")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "cueflow_tidal_lifecycle_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`) }()
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	repository, err := store.Open(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer repository.Close()
	if err := repository.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	draft := domain.SetDraft{
		ID: "draft-a", SessionID: "session-a", Name: "Night drive — A", Variation: 1, CreatedAt: time.Now().UTC(),
		Tracks: []domain.SetTrack{{Position: 1, Track: domain.Track{ID: "track-a", SpotifyID: "spotify-a", Title: "Exact recording", Artist: "Artist"}}},
	}
	if err := repository.SaveDrafts(ctx, []domain.SetDraft{draft}); err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	playlistNames := map[string]string{}
	deletedNames := []string{}
	created := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/spotify/tracks":
			writer.Write([]byte(`{"tracks":[{"id":"spotify-a","external_ids":{"isrc":"ISRC-A"}}]}`))
		case request.Method == http.MethodGet && request.URL.Path == "/tidal/tracks":
			writer.Write([]byte(`{"data":[{"type":"tracks","id":"tidal-track-a","attributes":{"isrc":"ISRC-A","title":"Exact recording"}}]}`))
		case request.Method == http.MethodPost && request.URL.Path == "/tidal/playlists":
			var document struct {
				Data struct {
					Attributes struct {
						Name string `json:"name"`
					} `json:"attributes"`
				} `json:"data"`
			}
			if err := json.NewDecoder(request.Body).Decode(&document); err != nil {
				t.Error(err)
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			mu.Lock()
			created++
			id := fmt.Sprintf("playlist-%d", created)
			playlistNames[id] = document.Data.Attributes.Name
			mu.Unlock()
			fmt.Fprintf(writer, `{"data":{"type":"playlists","id":%q,"attributes":{"name":%q}}}`, id, document.Data.Attributes.Name)
		case request.Method == http.MethodGet && strings.HasPrefix(request.URL.Path, "/tidal/playlists/"):
			id := strings.TrimPrefix(request.URL.Path, "/tidal/playlists/")
			mu.Lock()
			name, ok := playlistNames[id]
			mu.Unlock()
			if !ok {
				http.NotFound(writer, request)
				return
			}
			fmt.Fprintf(writer, `{"data":{"type":"playlists","id":%q,"attributes":{"name":%q}}}`, id, name)
		case request.Method == http.MethodPost && strings.HasSuffix(request.URL.Path, "/relationships/items"):
			writer.Write([]byte(`{"data":[]}`))
		case request.Method == http.MethodDelete && strings.HasPrefix(request.URL.Path, "/tidal/playlists/"):
			id := strings.TrimPrefix(request.URL.Path, "/tidal/playlists/")
			mu.Lock()
			deletedNames = append(deletedNames, playlistNames[id])
			delete(playlistNames, id)
			mu.Unlock()
			writer.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	expires := time.Now().Add(time.Hour)
	spotifyClient := &spotify.Client{APIBase: server.URL + "/spotify", HTTPClient: server.Client(), Store: spotifyTokenStore{spotify.Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: expires}}}
	tidalClient := &tidal.Client{ClientID: "client", APIBase: server.URL + "/tidal", HTTPClient: server.Client(), Store: tidalTokenStore{tidal.Token{AccessToken: "access", RefreshToken: "refresh", ExpiresAt: expires}}}
	svc := New(repository).WithSpotify(spotifyClient).WithTidal(tidalClient)

	saved, err := svc.SaveTidalSet(ctx, draft.ID)
	if err != nil || !strings.HasPrefix(saved.Name, "Cueflow Set — ") {
		t.Fatalf("save permanent set: %#v err=%v", saved, err)
	}
	firstPreview, err := svc.PublishTidalPreviews(ctx, []string{draft.ID})
	if err != nil || len(firstPreview.Playlists) != 1 {
		t.Fatalf("first preview: %#v err=%v", firstPreview, err)
	}
	secondPreview, err := svc.PublishTidalPreviews(ctx, []string{draft.ID})
	if err != nil || secondPreview.DeletedPrevious != 1 {
		t.Fatalf("replace preview: %#v err=%v", secondPreview, err)
	}
	if len(deletedNames) != 1 || !strings.HasPrefix(deletedNames[0], "Cueflow Preview — ") {
		t.Fatalf("preview replacement deleted the wrong playlists: %#v", deletedNames)
	}
	sets, err := svc.TidalSavedSets(ctx)
	if err != nil || len(sets) != 1 || sets[0].PlaylistID != saved.PlaylistID {
		t.Fatalf("permanent registry changed during preview replacement: %#v err=%v", sets, err)
	}
}
