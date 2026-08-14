package analysisjson

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"github.com/nodelike/cueflow/internal/domain"
)

type envelope struct {
	Analyses []domain.TrackAnalysis `json:"analyses"`
}

// Parse accepts one analysis object, an array, or {"analyses": [...]}. Every
// shape is decoded strictly so analyzer/schema drift fails loudly at import.
func Parse(reader io.Reader) ([]domain.TrackAnalysis, error) {
	payload, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read temporal analysis JSON: %w", err)
	}
	payload = bytes.TrimSpace(payload)
	if len(payload) == 0 {
		return nil, fmt.Errorf("temporal analysis JSON is empty")
	}

	var analyses []domain.TrackAnalysis
	switch payload[0] {
	case '[':
		if err := decodeStrict(payload, &analyses); err != nil {
			return nil, err
		}
	case '{':
		var shape map[string]json.RawMessage
		if err := json.Unmarshal(payload, &shape); err != nil {
			return nil, fmt.Errorf("decode temporal analysis JSON: %w", err)
		}
		if _, wrapped := shape["analyses"]; wrapped {
			var input envelope
			if err := decodeStrict(payload, &input); err != nil {
				return nil, err
			}
			analyses = input.Analyses
		} else {
			var analysis domain.TrackAnalysis
			if err := decodeStrict(payload, &analysis); err != nil {
				return nil, err
			}
			analyses = []domain.TrackAnalysis{analysis}
		}
	default:
		return nil, fmt.Errorf("temporal analysis JSON must be an object or array")
	}
	if len(analyses) == 0 {
		return nil, fmt.Errorf("temporal analysis JSON contains no analyses")
	}

	identities := map[string]bool{}
	for index, analysis := range analyses {
		if err := analysis.Validate(); err != nil {
			return nil, fmt.Errorf("analysis[%d] track %q: %w", index, analysis.TrackID, err)
		}
		identity := analysis.TrackID + "\x00" + analysis.AudioFingerprint + "\x00" + analysis.AnalyzerVersion
		if identities[identity] {
			return nil, fmt.Errorf("analysis[%d] duplicates track/fingerprint/analyzer identity", index)
		}
		identities[identity] = true
	}
	return analyses, nil
}

func decodeStrict(payload []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("decode temporal analysis JSON: %w", err)
	}
	if decoder.More() {
		return fmt.Errorf("decode temporal analysis JSON: trailing value")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("decode temporal analysis JSON: trailing value")
		}
		return fmt.Errorf("decode temporal analysis JSON: %w", err)
	}
	return nil
}
