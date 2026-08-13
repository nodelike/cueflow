CREATE TABLE IF NOT EXISTS tidal_preview_playlists (
    playlist_id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    variation INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tidal_preview_playlists_session_idx
    ON tidal_preview_playlists (session_id, variation);
