package store

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"cueflow/internal/domain"
	"cueflow/internal/fixtures"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresRoundTripAndLatestSession(t *testing.T) {
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
	schema := "cueflow_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
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
	repository, err := Open(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer repository.Close()
	if err := repository.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	tracks := fixtures.Tracks()[:4]
	if err := repository.UpsertTracks(ctx, tracks); err != nil {
		t.Fatal(err)
	}
	listed, err := repository.ListTracks(ctx)
	if err != nil || len(listed) != 4 {
		t.Fatalf("track round trip: %d %v", len(listed), err)
	}
	now := time.Now().UTC()
	for session := 1; session <= 2; session++ {
		drafts := []domain.SetDraft{{ID: uuid.NewString(), SessionID: fmt.Sprintf("session-%d", session), Name: fmt.Sprintf("Draft %d", session), Variation: 1, Arc: "journey", DurationSeconds: 300, QualityScore: 80 + float64(session), CreatedAt: now.Add(time.Duration(session) * time.Second)}}
		if err := repository.SaveDrafts(ctx, drafts); err != nil {
			t.Fatal(err)
		}
	}
	latest, err := repository.ListDrafts(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(latest) != 1 || latest[0].SessionID != "session-2" {
		t.Fatalf("latest session filtering failed: %#v", latest)
	}
	trackCount, draftCount, err := repository.Count(ctx)
	if err != nil || trackCount != 4 || draftCount != 2 {
		t.Fatalf("counts: tracks=%d drafts=%d err=%v", trackCount, draftCount, err)
	}

	reviewTrack := domain.Track{
		ID:                 "spotify-review-1",
		SpotifyID:          "spotify-review-1",
		SpotifyURI:         "spotify:track:spotify-review-1",
		Title:              "Needs Research",
		Artist:             "Test Artist",
		DurationSeconds:    360,
		SourcePlaylist:     "Techno Vibezz",
		AddedAt:            now,
		FeatureProvenance:  "spotify-library-sync",
		FeatureNeedsReview: true,
	}
	if err := repository.UpsertTracks(ctx, []domain.Track{reviewTrack}); err != nil {
		t.Fatal(err)
	}
	queue, err := repository.ListNeedsReview(ctx, 10)
	if err != nil || len(queue) != 1 || queue[0].ID != reviewTrack.ID {
		t.Fatalf("review queue: %#v err=%v", queue, err)
	}
	enrichment := domain.TrackEnrichment{
		TrackID: reviewTrack.ID, BPM: 128, MusicalKey: "A minor", Camelot: "8A",
		Energy: 0.82, Groove: "driving", Vocal: 0.12, Role: "driver",
		Source: "manual-audio-review + https://example.test/evidence", Confidence: 0.91,
	}
	if err := repository.EnrichTrack(ctx, enrichment); err != nil {
		t.Fatal(err)
	}
	queue, err = repository.ListNeedsReview(ctx, 10)
	if err != nil || len(queue) != 0 {
		t.Fatalf("review flag was not cleared: %#v err=%v", queue, err)
	}
	var observationCount int
	if err := repository.pool.QueryRow(ctx, `SELECT COUNT(*) FROM feature_observations WHERE track_id=$1`, reviewTrack.ID).Scan(&observationCount); err != nil {
		t.Fatal(err)
	}
	if observationCount != 7 {
		t.Fatalf("observation provenance rows=%d, want 7", observationCount)
	}

	failedBatch := []domain.TrackEnrichment{
		{TrackID: reviewTrack.ID, BPM: 129, MusicalKey: "A minor", Camelot: "8A", Energy: .9, Groove: "driving", Vocal: .1, Role: "peak", Source: "batch-test", Confidence: .9},
		{TrackID: "missing", BPM: 130, MusicalKey: "B minor", Camelot: "10A", Energy: .9, Groove: "driving", Vocal: .1, Role: "peak", Source: "batch-test", Confidence: .9},
	}
	if err := repository.EnrichTracks(ctx, failedBatch); err == nil {
		t.Fatal("expected missing track to reject the batch")
	}
	var bpm float64
	if err := repository.pool.QueryRow(ctx, `SELECT bpm FROM tracks WHERE id=$1`, reviewTrack.ID).Scan(&bpm); err != nil {
		t.Fatal(err)
	}
	if bpm != 128 {
		t.Fatalf("failed batch was not atomic: BPM=%v", bpm)
	}
}
