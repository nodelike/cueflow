package store

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"cueflow/internal/domain"

	"github.com/jackc/pgx/v5"
)

// UpsertTrackAnalyses stores a validated batch atomically. An analyzer may be
// rerun idempotently (analyzedAt is excluded from the content identity), but
// changing evidence under the same track/fingerprint/analyzer identity is
// rejected to preserve reproducibility.
func (p *Postgres) UpsertTrackAnalyses(ctx context.Context, analyses []domain.TrackAnalysis) error {
	if len(analyses) == 0 {
		return nil
	}
	for index, analysis := range analyses {
		if err := analysis.Validate(); err != nil {
			return fmt.Errorf("analysis[%d] track %q: %w", index, analysis.TrackID, err)
		}
	}

	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin temporal analysis import: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, analysis := range analyses {
		var catalogDuration int
		if err := tx.QueryRow(ctx, `SELECT duration_seconds FROM tracks WHERE id=$1 FOR SHARE`, analysis.TrackID).Scan(&catalogDuration); err != nil {
			if err == pgx.ErrNoRows {
				return fmt.Errorf("temporal analysis references unknown track %q", analysis.TrackID)
			}
			return fmt.Errorf("read track %q for temporal analysis: %w", analysis.TrackID, err)
		}
		compatible, tolerance := analysisDurationCompatible(catalogDuration, analysis.DurationSeconds)
		if !compatible {
			return fmt.Errorf("track %q analysis duration %.2fs differs from catalog duration %ds by more than %.2fs; full-recording audio is required", analysis.TrackID, analysis.DurationSeconds, catalogDuration, tolerance)
		}

		payload, err := json.Marshal(analysis)
		if err != nil {
			return fmt.Errorf("encode temporal analysis for track %q: %w", analysis.TrackID, err)
		}
		contentHash, err := analysisContentHash(analysis)
		if err != nil {
			return fmt.Errorf("hash temporal analysis for track %q: %w", analysis.TrackID, err)
		}
		result, err := tx.Exec(ctx, `
INSERT INTO track_analyses (
  track_id, audio_fingerprint, analyzer_version, schema_version, duration_seconds,
  tempo_bpm, tempo_confidence, content_hash, payload, analyzed_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
ON CONFLICT (track_id, audio_fingerprint, analyzer_version) DO UPDATE SET
  imported_at=track_analyses.imported_at
WHERE track_analyses.content_hash=EXCLUDED.content_hash`,
			analysis.TrackID, analysis.AudioFingerprint, analysis.AnalyzerVersion,
			analysis.SchemaVersion, analysis.DurationSeconds, analysis.TempoBPM,
			analysis.TempoConfidence, contentHash, payload, analysis.AnalyzedAt,
		)
		if err != nil {
			return fmt.Errorf("store temporal analysis for track %q: %w", analysis.TrackID, err)
		}
		if result.RowsAffected() == 0 {
			return fmt.Errorf("track %q already has different payload for fingerprint %q and analyzer %q", analysis.TrackID, analysis.AudioFingerprint, analysis.AnalyzerVersion)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit temporal analysis import: %w", err)
	}
	return nil
}

func analysisDurationCompatible(catalogDuration int, analysisDuration float64) (bool, float64) {
	tolerance := math.Max(3, float64(catalogDuration)*.02)
	return math.Abs(float64(catalogDuration)-analysisDuration) <= tolerance, tolerance
}

func analysisContentHash(analysis domain.TrackAnalysis) (string, error) {
	analysis.AnalyzedAt = time.Time{}
	payload, err := json.Marshal(analysis)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(payload)
	return fmt.Sprintf("sha256:%x", digest), nil
}

func (p *Postgres) LatestTrackAnalyses(ctx context.Context, trackIDs []string) (map[string]domain.TrackAnalysis, error) {
	if len(trackIDs) == 0 {
		return map[string]domain.TrackAnalysis{}, nil
	}
	rows, err := p.pool.Query(ctx, `
SELECT DISTINCT ON (track_id) track_id, payload
FROM track_analyses
WHERE track_id=ANY($1::text[])
ORDER BY track_id, analyzed_at DESC, imported_at DESC`, trackIDs)
	if err != nil {
		return nil, fmt.Errorf("list latest temporal analyses: %w", err)
	}
	defer rows.Close()

	analyses := make(map[string]domain.TrackAnalysis)
	for rows.Next() {
		var trackID string
		var payload []byte
		if err := rows.Scan(&trackID, &payload); err != nil {
			return nil, fmt.Errorf("scan temporal analysis: %w", err)
		}
		var analysis domain.TrackAnalysis
		if err := json.Unmarshal(payload, &analysis); err != nil {
			return nil, fmt.Errorf("decode temporal analysis for track %q: %w", trackID, err)
		}
		if err := analysis.Validate(); err != nil {
			return nil, fmt.Errorf("stored temporal analysis for track %q is invalid: %w", trackID, err)
		}
		if analysis.TrackID != trackID {
			return nil, fmt.Errorf("stored temporal analysis key %q contains payload for %q", trackID, analysis.TrackID)
		}
		analyses[trackID] = analysis
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list latest temporal analyses: %w", err)
	}
	return analyses, nil
}
