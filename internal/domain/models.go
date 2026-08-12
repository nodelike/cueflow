package domain

import "time"

type Track struct {
	ID                 string    `json:"id"`
	SpotifyID          string    `json:"spotifyId,omitempty"`
	SpotifyURI         string    `json:"spotifyUri,omitempty"`
	Title              string    `json:"title"`
	Artist             string    `json:"artist"`
	DurationSeconds    int       `json:"durationSeconds"`
	BPM                float64   `json:"bpm"`
	MusicalKey         string    `json:"musicalKey"`
	Camelot            string    `json:"camelot"`
	Energy             float64   `json:"energy"`
	Groove             string    `json:"groove"`
	Vocal              float64   `json:"vocal"`
	Role               string    `json:"role"`
	SourcePlaylist     string    `json:"sourcePlaylist"`
	AddedAt            time.Time `json:"addedAt"`
	FeatureConfidence  float64   `json:"featureConfidence"`
	FeatureProvenance  string    `json:"featureProvenance"`
	FeatureNeedsReview bool      `json:"featureNeedsReview"`
}

type FeatureObservation struct {
	ID         string    `json:"id"`
	TrackID    string    `json:"trackId"`
	Feature    string    `json:"feature"`
	Value      string    `json:"value"`
	Source     string    `json:"source"`
	Confidence float64   `json:"confidence"`
	ObservedAt time.Time `json:"observedAt"`
}

type TrackEnrichment struct {
	TrackID    string  `json:"trackId"`
	BPM        float64 `json:"bpm"`
	MusicalKey string  `json:"musicalKey"`
	Camelot    string  `json:"camelot"`
	Energy     float64 `json:"energy"`
	Groove     string  `json:"groove"`
	Vocal      float64 `json:"vocal"`
	Role       string  `json:"role"`
	Source     string  `json:"source"`
	Confidence float64 `json:"confidence"`
}

type GenerateRequest struct {
	Name               string   `json:"name"`
	DurationMinutes    int      `json:"durationMinutes"`
	VariationCount     int      `json:"variationCount"`
	Arc                string   `json:"arc"`
	HarmonicStrictness float64  `json:"harmonicStrictness"`
	Exploration        float64  `json:"exploration"`
	StartBPM           float64  `json:"startBpm"`
	EndBPM             float64  `json:"endBpm"`
	AllowedGrooves     []string `json:"allowedGrooves,omitempty"`
	RequiredTrackIDs   []string `json:"requiredTrackIds,omitempty"`
	ExcludedTrackIDs   []string `json:"excludedTrackIds,omitempty"`
	Seed               int64    `json:"seed"`
}

func (r GenerateRequest) WithDefaults() GenerateRequest {
	if r.Name == "" {
		r.Name = "Untitled journey"
	}
	if r.DurationMinutes <= 0 {
		r.DurationMinutes = 60
	}
	if r.VariationCount <= 0 {
		r.VariationCount = 3
	}
	if r.VariationCount > 6 {
		r.VariationCount = 6
	}
	if r.Arc == "" {
		r.Arc = "journey"
	}
	if r.HarmonicStrictness == 0 {
		r.HarmonicStrictness = 0.72
	}
	if r.Exploration == 0 {
		r.Exploration = 0.28
	}
	return r
}

type ScoreComponent struct {
	Name  string  `json:"name"`
	Score float64 `json:"score"`
	Note  string  `json:"note"`
}

type Transition struct {
	FromTrackID string           `json:"fromTrackId"`
	ToTrackID   string           `json:"toTrackId"`
	Score       float64          `json:"score"`
	Risk        string           `json:"risk"`
	Summary     string           `json:"summary"`
	Components  []ScoreComponent `json:"components"`
}

type SetTrack struct {
	Position     int        `json:"position"`
	Track        Track      `json:"track"`
	TargetEnergy float64    `json:"targetEnergy"`
	Transition   Transition `json:"transition"`
}

type SetDraft struct {
	ID              string     `json:"id"`
	SessionID       string     `json:"sessionId"`
	Name            string     `json:"name"`
	Variation       int        `json:"variation"`
	Arc             string     `json:"arc"`
	DurationSeconds int        `json:"durationSeconds"`
	QualityScore    float64    `json:"qualityScore"`
	EnergyFit       float64    `json:"energyFit"`
	HarmonicFlow    float64    `json:"harmonicFlow"`
	TempoFlow       float64    `json:"tempoFlow"`
	Diversity       float64    `json:"diversity"`
	CreatedAt       time.Time  `json:"createdAt"`
	Tracks          []SetTrack `json:"tracks"`
}

type Bootstrap struct {
	DatabaseReady bool       `json:"databaseReady"`
	TrackCount    int        `json:"trackCount"`
	DraftCount    int        `json:"draftCount"`
	Tracks        []Track    `json:"tracks"`
	Drafts        []SetDraft `json:"drafts"`
	Error         string     `json:"error,omitempty"`
}
