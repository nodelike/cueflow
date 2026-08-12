package domain

import (
	"fmt"
	"math"
	"strings"
	"time"
)

const (
	TemporalAnalysisSchemaVersion = 1
	TransitionPlanVersion         = "cue-plan-v1"
)

const (
	CueKindIntro     = "intro"
	CueKindPhraseIn  = "phrase-in"
	CueKindBreakdown = "breakdown"
	CueKindDrop      = "drop"
	CueKindPhraseOut = "phrase-out"
	CueKindOutro     = "outro"
)

// TrackAnalysis is the versioned, full-recording temporal evidence consumed by
// the mix planner. Global Track features remain useful for broad set ordering;
// this record describes where a blend can actually happen.
type TrackAnalysis struct {
	SchemaVersion    int             `json:"schemaVersion"`
	TrackID          string          `json:"trackId"`
	AudioFingerprint string          `json:"audioFingerprint"`
	AnalyzerVersion  string          `json:"analyzerVersion"`
	DurationSeconds  float64         `json:"durationSeconds"`
	SampleRate       int             `json:"sampleRate"`
	Channels         int             `json:"channels"`
	TempoBPM         float64         `json:"tempoBpm"`
	TempoConfidence  float64         `json:"tempoConfidence"`
	Waveform         []WaveformPoint `json:"waveform"`
	Beats            []BeatMarker    `json:"beats"`
	Sections         []AudioSection  `json:"sections"`
	Frames           []AnalysisFrame `json:"frames"`
	CueCandidates    []CueCandidate  `json:"cueCandidates"`
	AnalyzedAt       time.Time       `json:"analyzedAt"`
}

// WaveformPoint is a downsampled amplitude envelope. It is intentionally not
// the raw PCM waveform: RMS and peak buckets are compact, inspectable, and
// sufficient for silence, transient, and headroom checks.
type WaveformPoint struct {
	StartSeconds float64 `json:"startSeconds"`
	EndSeconds   float64 `json:"endSeconds"`
	RMS          float64 `json:"rms"`
	Peak         float64 `json:"peak"`
}

type BeatMarker struct {
	TimeSeconds float64 `json:"timeSeconds"`
	BeatInBar   int     `json:"beatInBar"`
	BarIndex    int     `json:"barIndex"`
	Confidence  float64 `json:"confidence"`
}

type AudioSection struct {
	ID           string  `json:"id"`
	Label        string  `json:"label"`
	StartSeconds float64 `json:"startSeconds"`
	EndSeconds   float64 `json:"endSeconds"`
	Confidence   float64 `json:"confidence"`
}

// AnalysisFrame contains time-local features. Energy bands, spectral flux,
// percussive strength, vocal probability, and tonal strength are normalized to
// [0,1]; loudness remains in LUFS so gain matching retains physical meaning.
type AnalysisFrame struct {
	StartSeconds       float64   `json:"startSeconds"`
	EndSeconds         float64   `json:"endSeconds"`
	RMS                float64   `json:"rms"`
	Peak               float64   `json:"peak"`
	LoudnessLUFS       float64   `json:"loudnessLufs"`
	LowEnergy          float64   `json:"lowEnergy"`
	MidEnergy          float64   `json:"midEnergy"`
	HighEnergy         float64   `json:"highEnergy"`
	SpectralFlux       float64   `json:"spectralFlux"`
	PercussiveStrength float64   `json:"percussiveStrength"`
	VocalProbability   float64   `json:"vocalProbability"`
	TonalStrength      float64   `json:"tonalStrength"`
	Chroma             []float64 `json:"chroma"`
}

type CueWindowMetrics struct {
	LoudnessLUFS       float64   `json:"loudnessLufs"`
	Peak               float64   `json:"peak"`
	LowEnergy          float64   `json:"lowEnergy"`
	MidEnergy          float64   `json:"midEnergy"`
	HighEnergy         float64   `json:"highEnergy"`
	PercussiveStrength float64   `json:"percussiveStrength"`
	VocalProbability   float64   `json:"vocalProbability"`
	TonalStrength      float64   `json:"tonalStrength"`
	Chroma             []float64 `json:"chroma"`
}

type CueCandidate struct {
	ID           string           `json:"id"`
	Kind         string           `json:"kind"`
	StartSeconds float64          `json:"startSeconds"`
	EndSeconds   float64          `json:"endSeconds"`
	BeatIndex    int              `json:"beatIndex"`
	BarIndex     int              `json:"barIndex"`
	Bars         int              `json:"bars"`
	Confidence   float64          `json:"confidence"`
	Metrics      CueWindowMetrics `json:"metrics"`
	Reasons      []string         `json:"reasons,omitempty"`
}

type AutomationPoint struct {
	Bar   float64 `json:"bar"`
	Value float64 `json:"value"`
}

type AutomationLane struct {
	Target string            `json:"target"`
	Points []AutomationPoint `json:"points"`
}

// TransitionPlan is an executable proposal, not proof that a rendered blend
// sounds good. RenderValidationRequired remains true until an audio render is
// checked for clipping, loudness, masking, phase, and audible artifacts.
type TransitionPlan struct {
	Version                  string           `json:"version"`
	FromCueID                string           `json:"fromCueId"`
	ToCueID                  string           `json:"toCueId"`
	Style                    string           `json:"style"`
	Bars                     int              `json:"bars"`
	FromStartSeconds         float64          `json:"fromStartSeconds"`
	FromEndSeconds           float64          `json:"fromEndSeconds"`
	ToStartSeconds           float64          `json:"toStartSeconds"`
	ToEndSeconds             float64          `json:"toEndSeconds"`
	TempoAdjustmentPct       float64          `json:"tempoAdjustmentPct"`
	BassSwapBar              int              `json:"bassSwapBar"`
	Score                    float64          `json:"score"`
	Risk                     string           `json:"risk"`
	Confidence               float64          `json:"confidence"`
	Components               []ScoreComponent `json:"components"`
	Automation               []AutomationLane `json:"automation"`
	Notes                    []string         `json:"notes"`
	RenderValidationRequired bool             `json:"renderValidationRequired"`
}

func (a TrackAnalysis) Validate() error {
	if a.SchemaVersion != TemporalAnalysisSchemaVersion {
		return fmt.Errorf("schemaVersion must be %d", TemporalAnalysisSchemaVersion)
	}
	if strings.TrimSpace(a.TrackID) == "" {
		return fmt.Errorf("trackId is required")
	}
	if strings.TrimSpace(a.AudioFingerprint) == "" {
		return fmt.Errorf("audioFingerprint is required")
	}
	if strings.TrimSpace(a.AnalyzerVersion) == "" {
		return fmt.Errorf("analyzerVersion is required")
	}
	if !finiteInRange(a.DurationSeconds, .01, 24*60*60) {
		return fmt.Errorf("durationSeconds must be finite and between 0 and 86400")
	}
	if a.SampleRate < 8000 || a.SampleRate > 384000 {
		return fmt.Errorf("sampleRate must be between 8000 and 384000")
	}
	if a.Channels < 1 || a.Channels > 16 {
		return fmt.Errorf("channels must be between 1 and 16")
	}
	if !finiteInRange(a.TempoBPM, 30, 300) {
		return fmt.Errorf("tempoBpm must be between 30 and 300")
	}
	if !normalized(a.TempoConfidence) {
		return fmt.Errorf("tempoConfidence must be between 0 and 1")
	}
	if a.AnalyzedAt.IsZero() {
		return fmt.Errorf("analyzedAt is required")
	}
	if len(a.Waveform) == 0 || len(a.Beats) < 2 || len(a.Frames) == 0 || len(a.CueCandidates) == 0 {
		return fmt.Errorf("waveform, at least two beats, frames, and cueCandidates are required")
	}

	previousEnd := -1.0
	for index, point := range a.Waveform {
		if err := validateWindow(point.StartSeconds, point.EndSeconds, a.DurationSeconds); err != nil {
			return fmt.Errorf("waveform[%d]: %w", index, err)
		}
		if point.StartSeconds < previousEnd {
			return fmt.Errorf("waveform[%d]: buckets must be ordered and non-overlapping", index)
		}
		if !normalized(point.RMS) || !normalized(point.Peak) || point.RMS > point.Peak {
			return fmt.Errorf("waveform[%d]: rms/peak must be normalized and rms cannot exceed peak", index)
		}
		previousEnd = point.EndSeconds
	}

	previousBeat := -1.0
	for index, beat := range a.Beats {
		if !finiteInRange(beat.TimeSeconds, 0, a.DurationSeconds) || beat.TimeSeconds <= previousBeat {
			return fmt.Errorf("beats[%d]: times must be finite, in range, and strictly increasing", index)
		}
		if beat.BeatInBar < 1 || beat.BeatInBar > 16 || beat.BarIndex < 0 || !normalized(beat.Confidence) {
			return fmt.Errorf("beats[%d]: invalid beat/bar position or confidence", index)
		}
		previousBeat = beat.TimeSeconds
	}

	previousSectionEnd := -1.0
	sectionIDs := map[string]bool{}
	for index, section := range a.Sections {
		if section.ID == "" || section.Label == "" || sectionIDs[section.ID] {
			return fmt.Errorf("sections[%d]: id and label must be present and id must be unique", index)
		}
		if err := validateWindow(section.StartSeconds, section.EndSeconds, a.DurationSeconds); err != nil {
			return fmt.Errorf("sections[%d]: %w", index, err)
		}
		if section.StartSeconds < previousSectionEnd || !normalized(section.Confidence) {
			return fmt.Errorf("sections[%d]: sections must be ordered/non-overlapping and confidence normalized", index)
		}
		sectionIDs[section.ID] = true
		previousSectionEnd = section.EndSeconds
	}

	previousFrameStart := -1.0
	for index, frame := range a.Frames {
		if err := validateWindow(frame.StartSeconds, frame.EndSeconds, a.DurationSeconds); err != nil {
			return fmt.Errorf("frames[%d]: %w", index, err)
		}
		if frame.StartSeconds < previousFrameStart {
			return fmt.Errorf("frames[%d]: frames must be ordered", index)
		}
		if err := validateFrame(frame); err != nil {
			return fmt.Errorf("frames[%d]: %w", index, err)
		}
		previousFrameStart = frame.StartSeconds
	}

	cueIDs := map[string]bool{}
	for index, cue := range a.CueCandidates {
		if cue.ID == "" || cueIDs[cue.ID] {
			return fmt.Errorf("cueCandidates[%d]: id is required and must be unique", index)
		}
		if !validCueKind(cue.Kind) {
			return fmt.Errorf("cueCandidates[%d]: unsupported kind %q", index, cue.Kind)
		}
		if err := validateWindow(cue.StartSeconds, cue.EndSeconds, a.DurationSeconds); err != nil {
			return fmt.Errorf("cueCandidates[%d]: %w", index, err)
		}
		if cue.BeatIndex < 0 || cue.BeatIndex >= len(a.Beats) || cue.BarIndex < 0 || cue.Bars < 4 || cue.Bars > 128 || !normalized(cue.Confidence) {
			return fmt.Errorf("cueCandidates[%d]: invalid beat/bar placement, length, or confidence", index)
		}
		if err := validateCueMetrics(cue.Metrics); err != nil {
			return fmt.Errorf("cueCandidates[%d]: %w", index, err)
		}
		cueIDs[cue.ID] = true
	}
	return nil
}

func validCueKind(value string) bool {
	switch value {
	case CueKindIntro, CueKindPhraseIn, CueKindBreakdown, CueKindDrop, CueKindPhraseOut, CueKindOutro:
		return true
	default:
		return false
	}
}

func validateFrame(frame AnalysisFrame) error {
	values := []float64{frame.RMS, frame.Peak, frame.LowEnergy, frame.MidEnergy, frame.HighEnergy, frame.SpectralFlux, frame.PercussiveStrength, frame.VocalProbability, frame.TonalStrength}
	for _, value := range values {
		if !normalized(value) {
			return fmt.Errorf("normalized features must be between 0 and 1")
		}
	}
	if frame.RMS > frame.Peak {
		return fmt.Errorf("rms cannot exceed peak")
	}
	if !finiteInRange(frame.LoudnessLUFS, -120, 24) {
		return fmt.Errorf("loudnessLufs must be between -120 and 24")
	}
	return validateChroma(frame.Chroma)
}

func validateCueMetrics(metrics CueWindowMetrics) error {
	values := []float64{metrics.Peak, metrics.LowEnergy, metrics.MidEnergy, metrics.HighEnergy, metrics.PercussiveStrength, metrics.VocalProbability, metrics.TonalStrength}
	for _, value := range values {
		if !normalized(value) {
			return fmt.Errorf("cue-window features must be between 0 and 1")
		}
	}
	if !finiteInRange(metrics.LoudnessLUFS, -120, 24) {
		return fmt.Errorf("cue-window loudnessLufs must be between -120 and 24")
	}
	return validateChroma(metrics.Chroma)
}

func validateChroma(chroma []float64) error {
	if len(chroma) != 0 && len(chroma) != 12 {
		return fmt.Errorf("chroma must be empty or contain 12 pitch classes")
	}
	for _, value := range chroma {
		if !normalized(value) {
			return fmt.Errorf("chroma values must be between 0 and 1")
		}
	}
	return nil
}

func validateWindow(start, end, duration float64) error {
	if !finiteInRange(start, 0, duration) || !finiteInRange(end, 0, duration) || end <= start {
		return fmt.Errorf("window must be finite, positive, and inside the recording")
	}
	return nil
}

func normalized(value float64) bool { return finiteInRange(value, 0, 1) }

func finiteInRange(value, minimum, maximum float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= minimum && value <= maximum
}
