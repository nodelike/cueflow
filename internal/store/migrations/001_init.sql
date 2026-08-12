CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    spotify_id TEXT NOT NULL DEFAULT '',
    spotify_uri TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    bpm DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (bpm >= 0),
    musical_key TEXT NOT NULL DEFAULT '',
    camelot TEXT NOT NULL DEFAULT '',
    energy DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (energy BETWEEN 0 AND 1),
    groove TEXT NOT NULL DEFAULT '',
    vocal DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (vocal BETWEEN 0 AND 1),
    role TEXT NOT NULL DEFAULT '',
    source_playlist TEXT NOT NULL DEFAULT '',
    added_at TIMESTAMPTZ NOT NULL,
    feature_confidence DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (feature_confidence BETWEEN 0 AND 1),
    feature_provenance TEXT NOT NULL DEFAULT '',
    feature_needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tracks_spotify_uri_unique
    ON tracks (spotify_uri) WHERE spotify_uri <> '';
CREATE INDEX IF NOT EXISTS tracks_added_at_idx ON tracks (added_at);
CREATE INDEX IF NOT EXISTS tracks_source_playlist_idx ON tracks (source_playlist);

CREATE TABLE IF NOT EXISTS feature_observations (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    observed_at TIMESTAMPTZ NOT NULL,
    UNIQUE (track_id, feature, value, source)
);

CREATE TABLE IF NOT EXISTS set_drafts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    variation INTEGER NOT NULL,
    arc TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    quality_score DOUBLE PRECISION NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE set_drafts ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS set_drafts_created_at_idx ON set_drafts (created_at DESC);
CREATE INDEX IF NOT EXISTS set_drafts_session_id_idx ON set_drafts (session_id, variation);

CREATE TABLE IF NOT EXISTS spotify_playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('source', 'master', 'draft')),
    writable BOOLEAN NOT NULL DEFAULT FALSE,
    snapshot_id TEXT NOT NULL DEFAULT '',
    synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES spotify_playlists(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
);
