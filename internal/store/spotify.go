package store

import (
	"context"
	"fmt"

	"cueflow/internal/domain"
	"cueflow/internal/spotify"

	"github.com/jackc/pgx/v5"
)

func (p *Postgres) SyncPlaylist(ctx context.Context, playlist spotify.Playlist, items []spotify.SyncedTrack) error {
	tracks := make([]domain.Track, 0, len(items))
	for _, item := range items {
		tracks = append(tracks, item.DomainTrack())
	}
	if err := p.UpsertTracks(ctx, tracks); err != nil {
		return err
	}
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `
INSERT INTO spotify_playlists (id,name,kind,writable,synced_at)
VALUES ($1,$2,$3,$4,NOW())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind,
  writable=EXCLUDED.writable, synced_at=EXCLUDED.synced_at`,
		playlist.ID, playlist.Name, playlist.Kind, playlist.Writable)
	if err != nil {
		return fmt.Errorf("save playlist: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM playlist_tracks WHERE playlist_id=$1`, playlist.ID); err != nil {
		return err
	}
	for _, item := range items {
		_, err := tx.Exec(ctx, `INSERT INTO playlist_tracks (playlist_id,track_id,position,added_at) VALUES ($1,$2,$3,$4)`,
			playlist.ID, "spotify-"+item.DomainTrack().SpotifyID, item.Position, item.AddedAt)
		if err != nil {
			return fmt.Errorf("save playlist membership: %w", err)
		}
	}
	return tx.Commit(ctx)
}
