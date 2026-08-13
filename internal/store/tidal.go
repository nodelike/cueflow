package store

import (
	"context"
	"fmt"

	"cueflow/internal/tidal"

	"github.com/jackc/pgx/v5"
)

func (p *Postgres) TidalPreviews(ctx context.Context) ([]tidal.PreviewPlaylist, error) {
	rows, err := p.pool.Query(ctx, `
SELECT playlist_id, draft_id, session_id, variation, name, created_at
FROM tidal_preview_playlists
ORDER BY created_at, variation`)
	if err != nil {
		return nil, fmt.Errorf("list TIDAL previews: %w", err)
	}
	defer rows.Close()
	previews := []tidal.PreviewPlaylist{}
	for rows.Next() {
		var preview tidal.PreviewPlaylist
		if err := rows.Scan(&preview.PlaylistID, &preview.DraftID, &preview.SessionID, &preview.Variation, &preview.Name, &preview.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan TIDAL preview: %w", err)
		}
		previews = append(previews, preview)
	}
	return previews, rows.Err()
}

func (p *Postgres) ReplaceTidalPreviews(ctx context.Context, previews []tidal.PreviewPlaylist) error {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin TIDAL preview replacement: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM tidal_preview_playlists`); err != nil {
		return fmt.Errorf("clear TIDAL preview registry: %w", err)
	}
	for _, preview := range previews {
		_, err := tx.Exec(ctx, `
INSERT INTO tidal_preview_playlists (playlist_id, draft_id, session_id, variation, name, created_at)
VALUES ($1,$2,$3,$4,$5,$6)`, preview.PlaylistID, preview.DraftID, preview.SessionID, preview.Variation, preview.Name, preview.CreatedAt)
		if err != nil {
			return fmt.Errorf("register TIDAL preview %s: %w", preview.PlaylistID, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit TIDAL preview replacement: %w", err)
	}
	return nil
}

func (p *Postgres) TidalSavedSets(ctx context.Context) ([]tidal.SavedSet, error) {
	rows, err := p.pool.Query(ctx, `
SELECT playlist_id, draft_id, session_id, variation, name, track_count, created_at
FROM tidal_saved_sets
ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list saved TIDAL sets: %w", err)
	}
	defer rows.Close()
	sets := []tidal.SavedSet{}
	for rows.Next() {
		var set tidal.SavedSet
		if err := rows.Scan(&set.PlaylistID, &set.DraftID, &set.SessionID, &set.Variation, &set.Name, &set.TrackCount, &set.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan saved TIDAL set: %w", err)
		}
		sets = append(sets, set)
	}
	return sets, rows.Err()
}

func (p *Postgres) TidalSavedSetForDraft(ctx context.Context, draftID string) (tidal.SavedSet, bool, error) {
	var set tidal.SavedSet
	err := p.pool.QueryRow(ctx, `
SELECT playlist_id, draft_id, session_id, variation, name, track_count, created_at
FROM tidal_saved_sets
WHERE draft_id=$1`, draftID).Scan(
		&set.PlaylistID, &set.DraftID, &set.SessionID, &set.Variation, &set.Name, &set.TrackCount, &set.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return tidal.SavedSet{}, false, nil
	}
	if err != nil {
		return tidal.SavedSet{}, false, fmt.Errorf("get saved TIDAL set for draft: %w", err)
	}
	return set, true, nil
}

func (p *Postgres) SaveTidalSet(ctx context.Context, set tidal.SavedSet) error {
	_, err := p.pool.Exec(ctx, `
INSERT INTO tidal_saved_sets (playlist_id, draft_id, session_id, variation, name, track_count, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (draft_id) DO NOTHING`, set.PlaylistID, set.DraftID, set.SessionID, set.Variation, set.Name, set.TrackCount, set.CreatedAt)
	if err != nil {
		return fmt.Errorf("save permanent TIDAL set: %w", err)
	}
	return nil
}
