package analysisjson

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/nodelike/cueflow/internal/domain"
)

func TestParseAcceptsSingleArrayAndEnvelope(t *testing.T) {
	analysis := validAnalysis("track-one")
	single, _ := json.Marshal(analysis)
	array, _ := json.Marshal([]domain.TrackAnalysis{analysis})
	wrapped, _ := json.Marshal(map[string]any{"analyses": []domain.TrackAnalysis{analysis}})

	for name, payload := range map[string][]byte{"single": single, "array": array, "envelope": wrapped} {
		t.Run(name, func(t *testing.T) {
			parsed, err := Parse(bytes.NewReader(payload))
			if err != nil || len(parsed) != 1 || parsed[0].TrackID != analysis.TrackID {
				t.Fatalf("parsed=%#v err=%v", parsed, err)
			}
		})
	}
}

func TestParseRejectsSchemaDriftAndInvalidTemporalData(t *testing.T) {
	analysis := validAnalysis("track-one")
	payload, _ := json.Marshal(analysis)
	var object map[string]any
	if err := json.Unmarshal(payload, &object); err != nil {
		t.Fatal(err)
	}
	object["mysteryFeature"] = true
	withUnknown, _ := json.Marshal(object)
	if _, err := Parse(bytes.NewReader(withUnknown)); err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("unknown analyzer output was accepted: %v", err)
	}

	analysis.Waveform[1].StartSeconds = 3
	invalid, _ := json.Marshal(analysis)
	if _, err := Parse(bytes.NewReader(invalid)); err == nil || !strings.Contains(err.Error(), "non-overlapping") {
		t.Fatalf("overlapping waveform buckets were accepted: %v", err)
	}
}

func TestParseRejectsDuplicateAnalysisIdentity(t *testing.T) {
	analysis := validAnalysis("track-one")
	payload, _ := json.Marshal([]domain.TrackAnalysis{analysis, analysis})
	if _, err := Parse(bytes.NewReader(payload)); err == nil || !strings.Contains(err.Error(), "duplicates") {
		t.Fatalf("duplicate identity was accepted: %v", err)
	}
}

func validAnalysis(trackID string) domain.TrackAnalysis {
	return domain.TrackAnalysis{
		SchemaVersion:    domain.TemporalAnalysisSchemaVersion,
		TrackID:          trackID,
		AudioFingerprint: "sha256:0123456789abcdef",
		AnalyzerVersion:  "cueflow-librosa/1.0.0",
		DurationSeconds:  10,
		SampleRate:       44100,
		Channels:         2,
		TempoBPM:         120,
		TempoConfidence:  .94,
		Waveform: []domain.WaveformPoint{
			{StartSeconds: 0, EndSeconds: 5, RMS: .2, Peak: .5},
			{StartSeconds: 5, EndSeconds: 10, RMS: .3, Peak: .7},
		},
		Beats: []domain.BeatMarker{
			{TimeSeconds: 0, BeatInBar: 1, BarIndex: 0, Confidence: .9},
			{TimeSeconds: .5, BeatInBar: 2, BarIndex: 0, Confidence: .9},
		},
		Sections: []domain.AudioSection{{ID: "section-1", Label: "intro", StartSeconds: 0, EndSeconds: 10, Confidence: .8}},
		Frames: []domain.AnalysisFrame{{
			StartSeconds: 0, EndSeconds: 1, RMS: .2, Peak: .5, LoudnessLUFS: -12,
			LowEnergy: .3, MidEnergy: .4, HighEnergy: .2, SpectralFlux: .3,
			PercussiveStrength: .7, VocalProbability: .1, TonalStrength: .4,
		}},
		CueCandidates: []domain.CueCandidate{{
			ID: "cue-1", Kind: domain.CueKindIntro, StartSeconds: 0, EndSeconds: 8,
			BeatIndex: 0, BarIndex: 0, Bars: 4, Confidence: .88,
			Metrics: domain.CueWindowMetrics{LoudnessLUFS: -12, Peak: .5, LowEnergy: .3, MidEnergy: .4, HighEnergy: .2, PercussiveStrength: .7, VocalProbability: .1, TonalStrength: .4},
		}},
		AnalyzedAt: time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC),
	}
}
