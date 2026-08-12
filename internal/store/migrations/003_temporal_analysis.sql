CREATE TABLE IF NOT EXISTS track_analyses (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    audio_fingerprint TEXT NOT NULL,
    analyzer_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds > 0),
    tempo_bpm DOUBLE PRECISION NOT NULL CHECK (tempo_bpm BETWEEN 30 AND 300),
    tempo_confidence DOUBLE PRECISION NOT NULL CHECK (tempo_confidence BETWEEN 0 AND 1),
    content_hash TEXT NOT NULL,
    payload JSONB NOT NULL,
    analyzed_at TIMESTAMPTZ NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (track_id, audio_fingerprint, analyzer_version)
);

CREATE INDEX IF NOT EXISTS track_analyses_latest_idx
    ON track_analyses (track_id, analyzed_at DESC, imported_at DESC);
