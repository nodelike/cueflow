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
	"cueflow/internal/tidal"

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
	tracks[0].AlbumImageURL = "https://image.test/album"
	if err := repository.UpsertTracks(ctx, tracks); err != nil {
		t.Fatal(err)
	}
	feedback, err := repository.SaveTransitionFeedback(ctx, domain.TransitionFeedback{
		FromTrackID: tracks[0].ID, ToTrackID: tracks[1].ID, Verdict: domain.TransitionVerdictCompatible,
	})
	if err != nil || feedback.RecordedAt.IsZero() {
		t.Fatalf("save transition feedback: %#v err=%v", feedback, err)
	}
	feedback, err = repository.SaveTransitionFeedback(ctx, domain.TransitionFeedback{
		FromTrackID: tracks[0].ID, ToTrackID: tracks[1].ID, Verdict: domain.TransitionVerdictIncompatible,
	})
	if err != nil || feedback.Verdict != domain.TransitionVerdictIncompatible {
		t.Fatalf("update transition feedback: %#v err=%v", feedback, err)
	}
	feedbackItems, err := repository.ListTransitionFeedback(ctx)
	if err != nil || len(feedbackItems) != 1 || feedbackItems[0].Verdict != domain.TransitionVerdictIncompatible {
		t.Fatalf("transition feedback round trip: %#v err=%v", feedbackItems, err)
	}
	listed, err := repository.ListTracks(ctx)
	if err != nil || len(listed) != 4 {
		t.Fatalf("track round trip: %d %v", len(listed), err)
	}
	analysis := storeAnalysisFixture(tracks[0])
	if err := repository.UpsertTrackAnalyses(ctx, []domain.TrackAnalysis{analysis}); err != nil {
		t.Fatal(err)
	}
	if err := repository.UpsertTrackAnalyses(ctx, []domain.TrackAnalysis{analysis}); err != nil {
		t.Fatalf("idempotent analysis import failed: %v", err)
	}
	rerun := analysis
	rerun.AnalyzedAt = rerun.AnalyzedAt.Add(time.Hour)
	if err := repository.UpsertTrackAnalyses(ctx, []domain.TrackAnalysis{rerun}); err != nil {
		t.Fatalf("rerun with a different timestamp was not idempotent: %v", err)
	}
	latestAnalyses, err := repository.LatestTrackAnalyses(ctx, []string{tracks[0].ID})
	if err != nil || len(latestAnalyses) != 1 || latestAnalyses[tracks[0].ID].AudioFingerprint != analysis.AudioFingerprint {
		t.Fatalf("analysis round trip: %#v err=%v", latestAnalyses, err)
	}
	changedIdentity := analysis
	changedIdentity.TempoBPM++
	if err := repository.UpsertTrackAnalyses(ctx, []domain.TrackAnalysis{changedIdentity}); err == nil || !strings.Contains(err.Error(), "different payload") {
		t.Fatalf("non-reproducible analysis identity was accepted: %v", err)
	}
	previewOnly := storeAnalysisFixture(tracks[1])
	previewOnly.DurationSeconds = 30
	previewOnly.Waveform[0].EndSeconds = 30
	previewOnly.Sections[0].EndSeconds = 30
	previewOnly.CueCandidates[0].EndSeconds = 16
	if err := repository.UpsertTrackAnalyses(ctx, []domain.TrackAnalysis{previewOnly}); err == nil || !strings.Contains(err.Error(), "full-recording audio is required") {
		t.Fatalf("preview-only temporal analysis was accepted: %v", err)
	}
	now := time.Now().UTC()
	savedSet := tidal.SavedSet{PlaylistID: "tidal-set-1", DraftID: "draft-tidal-1", SessionID: "session-tidal", Variation: 2, Name: "Cueflow Set — Test B", TrackCount: 18, CreatedAt: now}
	if err := repository.SaveTidalSet(ctx, savedSet); err != nil {
		t.Fatal(err)
	}
	if err := repository.SaveTidalSet(ctx, savedSet); err != nil {
		t.Fatalf("idempotent saved-set registration failed: %v", err)
	}
	storedSet, found, err := repository.TidalSavedSetForDraft(ctx, savedSet.DraftID)
	if err != nil || !found || storedSet.PlaylistID != savedSet.PlaylistID {
		t.Fatalf("saved TIDAL set lookup: %#v found=%v err=%v", storedSet, found, err)
	}
	savedSets, err := repository.TidalSavedSets(ctx)
	if err != nil || len(savedSets) != 1 || savedSets[0].TrackCount != 18 {
		t.Fatalf("saved TIDAL set list: %#v err=%v", savedSets, err)
	}
	const playlistID = "crate-afro"
	if _, err := repository.pool.Exec(ctx, `INSERT INTO spotify_playlists(id,name,kind,writable,image_url,track_count,synced_at) VALUES($1,'Afro crate','source',FALSE,'https://image.test/crate',1,NOW())`, playlistID); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.pool.Exec(ctx, `INSERT INTO playlist_tracks(playlist_id,track_id,position,added_at) VALUES($1,$2,0,$3)`, playlistID, tracks[0].ID, now); err != nil {
		t.Fatal(err)
	}
	listed, err = repository.ListTracks(ctx)
	if err != nil || len(listed) != 1 || listed[0].ID != tracks[0].ID {
		t.Fatalf("all-synced catalog included non-members: %#v err=%v", listed, err)
	}
	filtered, err := repository.ListTracksForPlaylists(ctx, []string{playlistID}, nil)
	if err != nil || len(filtered) != 1 || filtered[0].ID != tracks[0].ID || filtered[0].AlbumImageURL == "" {
		t.Fatalf("playlist-filtered tracks: %#v err=%v", filtered, err)
	}
	requiredOverride, err := repository.ListTracksForPlaylists(ctx, []string{playlistID}, []string{tracks[1].ID})
	if err != nil || len(requiredOverride) != 2 {
		t.Fatalf("required track did not override source filter: %#v err=%v", requiredOverride, err)
	}
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

func storeAnalysisFixture(track domain.Track) domain.TrackAnalysis {
	duration := float64(track.DurationSeconds)
	metrics := domain.CueWindowMetrics{LoudnessLUFS: -12, Peak: .6, LowEnergy: .4, MidEnergy: .5, HighEnergy: .3, PercussiveStrength: .7, VocalProbability: .1, TonalStrength: .5}
	return domain.TrackAnalysis{
		SchemaVersion: domain.TemporalAnalysisSchemaVersion, TrackID: track.ID,
		AudioFingerprint: "sha256:test-" + track.ID, AnalyzerVersion: "test/1",
		DurationSeconds: duration, SampleRate: 44100, Channels: 2, TempoBPM: track.BPM, TempoConfidence: .9,
		Waveform:      []domain.WaveformPoint{{StartSeconds: 0, EndSeconds: duration, RMS: .2, Peak: .6}},
		Beats:         []domain.BeatMarker{{TimeSeconds: 0, BeatInBar: 1, BarIndex: 0, Confidence: .9}, {TimeSeconds: .5, BeatInBar: 2, BarIndex: 0, Confidence: .9}},
		Sections:      []domain.AudioSection{{ID: "full", Label: "full", StartSeconds: 0, EndSeconds: duration, Confidence: .8}},
		Frames:        []domain.AnalysisFrame{{StartSeconds: 0, EndSeconds: 1, RMS: .2, Peak: .6, LoudnessLUFS: -12, LowEnergy: .4, MidEnergy: .5, HighEnergy: .3, SpectralFlux: .2, PercussiveStrength: .7, VocalProbability: .1, TonalStrength: .5}},
		CueCandidates: []domain.CueCandidate{{ID: "intro", Kind: domain.CueKindIntro, StartSeconds: 0, EndSeconds: 16, BeatIndex: 0, BarIndex: 0, Bars: 8, Confidence: .9, Metrics: metrics}},
		AnalyzedAt:    time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC),
	}
}
