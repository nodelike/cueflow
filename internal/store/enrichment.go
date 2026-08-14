package store

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/nodelike/cueflow/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var camelotPattern = regexp.MustCompile(`^(?:[1-9]|1[0-2])[AB]$`)

func (p *Postgres) EnrichTrack(ctx context.Context, input domain.TrackEnrichment) error {
	return p.EnrichTracks(ctx, []domain.TrackEnrichment{input})
}

// EnrichTracks applies a reviewed batch atomically. One bad row leaves the catalog unchanged.
func (p *Postgres) EnrichTracks(ctx context.Context, inputs []domain.TrackEnrichment) error {
	if len(inputs) == 0 {
		return fmt.Errorf("at least one enrichment is required")
	}
	for index, input := range inputs {
		if err := validateEnrichment(input); err != nil {
			return fmt.Errorf("row %d: %w", index+1, err)
		}
	}
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for _, input := range inputs {
		result, err := tx.Exec(ctx, `UPDATE tracks SET bpm=$2,musical_key=$3,camelot=$4,energy=$5,groove=$6,vocal=$7,role=$8,feature_confidence=$9,feature_provenance=$10,feature_needs_review=FALSE,updated_at=NOW() WHERE id=$1`,
			input.TrackID, input.BPM, input.MusicalKey, input.Camelot, input.Energy, input.Groove, input.Vocal, input.Role, input.Confidence, input.Source)
		if err != nil {
			return err
		}
		if result.RowsAffected() != 1 {
			return fmt.Errorf("track %s not found", input.TrackID)
		}
		observations := map[string]string{
			"bpm":         strconv.FormatFloat(input.BPM, 'f', 3, 64),
			"musical_key": input.MusicalKey,
			"camelot":     input.Camelot,
			"energy":      strconv.FormatFloat(input.Energy, 'f', 3, 64),
			"groove":      input.Groove,
			"vocal":       strconv.FormatFloat(input.Vocal, 'f', 3, 64),
			"role":        input.Role,
		}
		for feature, value := range observations {
			_, err = tx.Exec(ctx, `INSERT INTO feature_observations (id,track_id,feature,value,source,confidence,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (track_id,feature,value,source) DO UPDATE SET confidence=EXCLUDED.confidence,observed_at=EXCLUDED.observed_at`, uuid.NewString(), input.TrackID, feature, value, input.Source, input.Confidence, time.Now().UTC())
			if err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

func validateEnrichment(input domain.TrackEnrichment) error {
	if input.TrackID == "" || input.Source == "" {
		return fmt.Errorf("trackId and source are required")
	}
	if input.BPM < 40 || input.BPM > 220 {
		return fmt.Errorf("BPM must be between 40 and 220")
	}
	if input.MusicalKey == "" || !camelotPattern.MatchString(input.Camelot) {
		return fmt.Errorf("a musical key and valid Camelot code are required")
	}
	if input.Groove == "" || input.Role == "" {
		return fmt.Errorf("groove and role are required")
	}
	if input.Confidence <= 0 || input.Confidence > 1 || input.Energy < 0 || input.Energy > 1 || input.Vocal < 0 || input.Vocal > 1 {
		return fmt.Errorf("confidence must be above 0 and confidence, energy, and vocal must be at most 1")
	}
	return nil
}

func (p *Postgres) ListNeedsReview(ctx context.Context, limit int) ([]domain.Track, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := p.pool.Query(ctx, `SELECT id,spotify_id,spotify_uri,title,artist,album_image_url,duration_seconds,bpm,musical_key,camelot,energy,groove,vocal,role,source_playlist,added_at,feature_confidence,feature_provenance,feature_needs_review FROM tracks WHERE feature_needs_review ORDER BY added_at,id LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Track{}
	for rows.Next() {
		var track domain.Track
		if err := rows.Scan(&track.ID, &track.SpotifyID, &track.SpotifyURI, &track.Title, &track.Artist, &track.AlbumImageURL, &track.DurationSeconds, &track.BPM, &track.MusicalKey, &track.Camelot, &track.Energy, &track.Groove, &track.Vocal, &track.Role, &track.SourcePlaylist, &track.AddedAt, &track.FeatureConfidence, &track.FeatureProvenance, &track.FeatureNeedsReview); err != nil {
			return nil, err
		}
		out = append(out, track)
	}
	return out, rows.Err()
}
