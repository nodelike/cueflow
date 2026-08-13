CREATE TABLE IF NOT EXISTS transition_feedback (
    from_track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    to_track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('compatible', 'incompatible')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (from_track_id, to_track_id),
    CHECK (from_track_id <> to_track_id)
);

CREATE INDEX IF NOT EXISTS transition_feedback_recorded_at_idx
    ON transition_feedback (recorded_at DESC);
