CREATE TABLE IF NOT EXISTS tidal_saved_sets (
    playlist_id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    variation INTEGER NOT NULL,
    name TEXT NOT NULL,
    track_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tidal_saved_sets_created_at_idx
    ON tidal_saved_sets (created_at DESC);
