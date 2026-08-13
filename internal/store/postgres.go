package store

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"cueflow/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Postgres struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("configure postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

func (p *Postgres) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }

func (p *Postgres) Migrate(ctx context.Context) error {
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		sql, err := migrations.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if _, err := p.pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply migration %s: %w", entry.Name(), err)
		}
	}
	return nil
}

func (p *Postgres) UpsertTracks(ctx context.Context, tracks []domain.Track) error {
	if len(tracks) == 0 {
		return nil
	}
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin track upsert: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	const query = `
INSERT INTO tracks (
  id, spotify_id, spotify_uri, title, artist, album_image_url, duration_seconds, bpm,
  musical_key, camelot, energy, groove, vocal, role, source_playlist,
  added_at, feature_confidence, feature_provenance, feature_needs_review, updated_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW()
)
ON CONFLICT (id) DO UPDATE SET
  spotify_id=EXCLUDED.spotify_id, spotify_uri=EXCLUDED.spotify_uri,
  title=EXCLUDED.title, artist=EXCLUDED.artist,
  album_image_url=CASE WHEN EXCLUDED.album_image_url <> '' THEN EXCLUDED.album_image_url ELSE tracks.album_image_url END,
  duration_seconds=EXCLUDED.duration_seconds,
  bpm=CASE WHEN EXCLUDED.bpm > 0 THEN EXCLUDED.bpm ELSE tracks.bpm END,
  musical_key=CASE WHEN EXCLUDED.musical_key <> '' THEN EXCLUDED.musical_key ELSE tracks.musical_key END,
  camelot=CASE WHEN EXCLUDED.camelot <> '' THEN EXCLUDED.camelot ELSE tracks.camelot END,
  energy=CASE WHEN EXCLUDED.energy > 0 THEN EXCLUDED.energy ELSE tracks.energy END,
  groove=CASE WHEN EXCLUDED.groove <> '' THEN EXCLUDED.groove ELSE tracks.groove END,
  vocal=CASE WHEN EXCLUDED.vocal > 0 THEN EXCLUDED.vocal ELSE tracks.vocal END,
  role=CASE WHEN EXCLUDED.role <> '' THEN EXCLUDED.role ELSE tracks.role END,
  source_playlist=CASE WHEN tracks.source_playlist <> '' THEN tracks.source_playlist ELSE EXCLUDED.source_playlist END,
  added_at=LEAST(tracks.added_at, EXCLUDED.added_at),
  feature_confidence=GREATEST(tracks.feature_confidence, EXCLUDED.feature_confidence),
  feature_provenance=CASE WHEN tracks.feature_confidence > EXCLUDED.feature_confidence THEN tracks.feature_provenance ELSE EXCLUDED.feature_provenance END,
  feature_needs_review=CASE WHEN tracks.feature_confidence >= 0.5 THEN tracks.feature_needs_review ELSE EXCLUDED.feature_needs_review END,
  updated_at=NOW()`
	for _, track := range tracks {
		if _, err := tx.Exec(ctx, query,
			track.ID, track.SpotifyID, track.SpotifyURI, track.Title, track.Artist,
			track.AlbumImageURL, track.DurationSeconds, track.BPM, track.MusicalKey, track.Camelot,
			track.Energy, track.Groove, track.Vocal, track.Role, track.SourcePlaylist,
			track.AddedAt, track.FeatureConfidence, track.FeatureProvenance,
			track.FeatureNeedsReview,
		); err != nil {
			return fmt.Errorf("upsert track %s: %w", track.ID, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit track upsert: %w", err)
	}
	return nil
}

func (p *Postgres) ListTracks(ctx context.Context) ([]domain.Track, error) {
	return p.listTracks(ctx, nil, nil)
}

func (p *Postgres) ListTracksForPlaylists(ctx context.Context, playlistIDs, requiredTrackIDs []string) ([]domain.Track, error) {
	return p.listTracks(ctx, playlistIDs, requiredTrackIDs)
}

func (p *Postgres) listTracks(ctx context.Context, playlistIDs, requiredTrackIDs []string) ([]domain.Track, error) {
	rows, err := p.pool.Query(ctx, `
SELECT t.id, t.spotify_id, t.spotify_uri, t.title, t.artist, t.album_image_url, t.duration_seconds, t.bpm,
       t.musical_key, t.camelot, t.energy, t.groove, t.vocal, t.role, t.source_playlist,
       t.added_at, t.feature_confidence, t.feature_provenance, t.feature_needs_review,
       COALESCE(array_agg(DISTINCT pt.playlist_id) FILTER (WHERE pt.playlist_id IS NOT NULL), '{}')
FROM tracks t
LEFT JOIN playlist_tracks pt ON pt.track_id=t.id
WHERE (COALESCE(cardinality($1::text[]), 0) = 0 AND (
        NOT EXISTS (SELECT 1 FROM spotify_playlists synced_playlist WHERE synced_playlist.kind <> 'draft')
        OR EXISTS (SELECT 1 FROM playlist_tracks synced_track WHERE synced_track.track_id=t.id)
      ))
   OR EXISTS (SELECT 1 FROM playlist_tracks selected WHERE selected.track_id=t.id AND selected.playlist_id=ANY($1::text[]))
   OR t.id=ANY($2::text[])
GROUP BY t.id
ORDER BY t.added_at, t.id`, playlistIDs, requiredTrackIDs)
	if err != nil {
		return nil, fmt.Errorf("list tracks: %w", err)
	}
	defer rows.Close()
	tracks := []domain.Track{}
	for rows.Next() {
		var track domain.Track
		if err := rows.Scan(
			&track.ID, &track.SpotifyID, &track.SpotifyURI, &track.Title, &track.Artist,
			&track.AlbumImageURL, &track.DurationSeconds, &track.BPM, &track.MusicalKey, &track.Camelot,
			&track.Energy, &track.Groove, &track.Vocal, &track.Role, &track.SourcePlaylist,
			&track.AddedAt, &track.FeatureConfidence, &track.FeatureProvenance,
			&track.FeatureNeedsReview, &track.SourcePlaylistIDs,
		); err != nil {
			return nil, fmt.Errorf("scan track: %w", err)
		}
		tracks = append(tracks, track)
	}
	return tracks, rows.Err()
}

func (p *Postgres) SaveDrafts(ctx context.Context, drafts []domain.SetDraft) error {
	if len(drafts) == 0 {
		return nil
	}
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin draft save: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for _, draft := range drafts {
		payload, err := json.Marshal(draft)
		if err != nil {
			return fmt.Errorf("encode draft: %w", err)
		}
		_, err = tx.Exec(ctx, `
INSERT INTO set_drafts (id, session_id, name, variation, arc, duration_seconds, quality_score, payload, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
ON CONFLICT (id) DO UPDATE SET
  session_id=EXCLUDED.session_id, name=EXCLUDED.name, variation=EXCLUDED.variation, arc=EXCLUDED.arc,
  duration_seconds=EXCLUDED.duration_seconds, quality_score=EXCLUDED.quality_score,
  payload=EXCLUDED.payload, created_at=EXCLUDED.created_at`,
			draft.ID, draft.SessionID, draft.Name, draft.Variation, draft.Arc, draft.DurationSeconds,
			draft.QualityScore, payload, draft.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("save draft %s: %w", draft.ID, err)
		}
	}
	return tx.Commit(ctx)
}

func (p *Postgres) ListDrafts(ctx context.Context, limit int) ([]domain.SetDraft, error) {
	if limit <= 0 {
		limit = 12
	}
	rows, err := p.pool.Query(ctx, `
WITH latest AS (
  SELECT session_id FROM set_drafts WHERE session_id <> '' ORDER BY created_at DESC LIMIT 1
)
SELECT payload FROM set_drafts
WHERE session_id = (SELECT session_id FROM latest)
ORDER BY variation
LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("list drafts: %w", err)
	}
	defer rows.Close()
	drafts := []domain.SetDraft{}
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, fmt.Errorf("scan draft: %w", err)
		}
		var draft domain.SetDraft
		if err := json.Unmarshal(payload, &draft); err != nil {
			return nil, fmt.Errorf("decode draft: %w", err)
		}
		drafts = append(drafts, draft)
	}
	return drafts, rows.Err()
}

func (p *Postgres) GetDraft(ctx context.Context, id string) (domain.SetDraft, error) {
	var payload []byte
	if err := p.pool.QueryRow(ctx, `SELECT payload FROM set_drafts WHERE id=$1`, id).Scan(&payload); err != nil {
		return domain.SetDraft{}, fmt.Errorf("get draft: %w", err)
	}
	var draft domain.SetDraft
	if err := json.Unmarshal(payload, &draft); err != nil {
		return domain.SetDraft{}, err
	}
	return draft, nil
}

func (p *Postgres) SaveTransitionFeedback(ctx context.Context, feedback domain.TransitionFeedback) (domain.TransitionFeedback, error) {
	if err := feedback.Validate(); err != nil {
		return domain.TransitionFeedback{}, err
	}
	if feedback.RecordedAt.IsZero() {
		feedback.RecordedAt = NowUTC()
	}
	err := p.pool.QueryRow(ctx, `
INSERT INTO transition_feedback (from_track_id, to_track_id, verdict, recorded_at)
VALUES ($1,$2,$3,$4)
ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
  verdict=EXCLUDED.verdict, recorded_at=EXCLUDED.recorded_at
RETURNING from_track_id, to_track_id, verdict, recorded_at`,
		feedback.FromTrackID, feedback.ToTrackID, feedback.Verdict, feedback.RecordedAt,
	).Scan(&feedback.FromTrackID, &feedback.ToTrackID, &feedback.Verdict, &feedback.RecordedAt)
	if err != nil {
		return domain.TransitionFeedback{}, fmt.Errorf("save transition feedback: %w", err)
	}
	return feedback, nil
}

func (p *Postgres) ListTransitionFeedback(ctx context.Context) ([]domain.TransitionFeedback, error) {
	rows, err := p.pool.Query(ctx, `
SELECT from_track_id, to_track_id, verdict, recorded_at
FROM transition_feedback
ORDER BY recorded_at DESC, from_track_id, to_track_id`)
	if err != nil {
		return nil, fmt.Errorf("list transition feedback: %w", err)
	}
	defer rows.Close()
	feedback := []domain.TransitionFeedback{}
	for rows.Next() {
		var item domain.TransitionFeedback
		if err := rows.Scan(&item.FromTrackID, &item.ToTrackID, &item.Verdict, &item.RecordedAt); err != nil {
			return nil, fmt.Errorf("scan transition feedback: %w", err)
		}
		feedback = append(feedback, item)
	}
	return feedback, rows.Err()
}

func (p *Postgres) DeleteDemoData(ctx context.Context) error {
	_, err := p.pool.Exec(ctx, `
DELETE FROM set_drafts;
DELETE FROM tracks WHERE id LIKE 'demo-%';`)
	return err
}

func (p *Postgres) Count(ctx context.Context) (tracks, drafts int, err error) {
	if err = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM tracks`).Scan(&tracks); err != nil {
		return 0, 0, err
	}
	if err = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM set_drafts`).Scan(&drafts); err != nil {
		return 0, 0, err
	}
	return tracks, drafts, nil
}

func NowUTC() time.Time { return time.Now().UTC() }
