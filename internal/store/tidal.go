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
