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
INSERT INTO spotify_playlists (id,name,kind,writable,image_url,track_count,synced_at)
VALUES ($1,$2,$3,$4,$5,$6,NOW())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind,
  writable=EXCLUDED.writable, image_url=EXCLUDED.image_url, track_count=EXCLUDED.track_count,
  synced_at=EXCLUDED.synced_at`,
		playlist.ID, playlist.Name, playlist.Kind, playlist.Writable, playlist.ImageURL, len(items))
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

// ListSyncedPlaylists reports the permanent crates already mirrored into the
// master library, newest sync first, without contacting Spotify.
func (p *Postgres) ListSyncedPlaylists(ctx context.Context) ([]domain.SourcePlaylist, error) {
	rows, err := p.pool.Query(ctx, `SELECT id,name,kind,image_url,track_count,synced_at FROM spotify_playlists WHERE kind <> 'draft' ORDER BY synced_at DESC, name`)
	if err != nil {
		return nil, fmt.Errorf("list synced playlists: %w", err)
	}
	defer rows.Close()
	playlists := []domain.SourcePlaylist{}
	for rows.Next() {
		var playlist domain.SourcePlaylist
		if err := rows.Scan(&playlist.ID, &playlist.Name, &playlist.Kind, &playlist.ImageURL, &playlist.TrackCount, &playlist.SyncedAt); err != nil {
			return nil, fmt.Errorf("scan synced playlist: %w", err)
		}
		playlists = append(playlists, playlist)
	}
	return playlists, rows.Err()
}

func (p *Postgres) SyncedPlaylists(ctx context.Context) (map[string]spotify.Playlist, error) {
	rows, err := p.pool.Query(ctx, `SELECT id,name,kind,writable,image_url,track_count FROM spotify_playlists WHERE kind <> 'draft' ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list synced playlists: %w", err)
	}
	defer rows.Close()
	result := map[string]spotify.Playlist{}
	for rows.Next() {
		var playlist spotify.Playlist
		if err := rows.Scan(&playlist.ID, &playlist.Name, &playlist.Kind, &playlist.Writable, &playlist.ImageURL, &playlist.TrackCount); err != nil {
			return nil, fmt.Errorf("scan synced playlist: %w", err)
		}
		playlist.Synced = true
		result[playlist.ID] = playlist
	}
	return result, rows.Err()
}
