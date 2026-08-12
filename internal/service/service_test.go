package service

import (
	"context"
	"net/url"
	"os"
	"strings"
	"testing"

	"cueflow/internal/spotify"
	"cueflow/internal/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

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
