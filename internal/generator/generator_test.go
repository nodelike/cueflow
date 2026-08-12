package generator

import (
	"math"
	"strings"
	"testing"

	"cueflow/internal/domain"
	"cueflow/internal/fixtures"
)

func TestGenerateProducesDistinctHighQualityVariations(t *testing.T) {
	request := domain.GenerateRequest{
		Name:               "Afro to pressure",
		DurationMinutes:    60,
		VariationCount:     3,
		Arc:                "journey",
		HarmonicStrictness: .76,
		Exploration:        .34,
		StartBPM:           118,
		EndBPM:             130,
		Seed:               9127,
	}
	drafts, err := New().Generate(fixtures.Tracks(), request)
	if err != nil {
		t.Fatal(err)
	}
	if len(drafts) != 3 {
		t.Fatalf("expected 3 variations, got %d", len(drafts))
	}

	sequences := map[string]bool{}
	for _, draft := range drafts {
		if draft.QualityScore < 70 {
			t.Errorf("%s quality %.1f is below the quality floor", draft.Name, draft.QualityScore)
		}
		if math.Abs(float64(draft.DurationSeconds-3600)) > 360 {
			t.Errorf("%s duration %d is too far from one hour", draft.Name, draft.DurationSeconds)
		}
		if delta := math.Abs(draft.Tracks[0].Track.BPM - request.StartBPM); delta > 7 {
			t.Errorf("%s opener misses requested BPM by %.1f", draft.Name, delta)
		}
		if delta := math.Abs(draft.Tracks[len(draft.Tracks)-1].Track.BPM - request.EndBPM); delta > 7 {
			t.Errorf("%s closer misses requested BPM by %.1f", draft.Name, delta)
		}
		seen := map[string]bool{}
		sequence := ""
		for _, item := range draft.Tracks {
			if seen[item.Track.ID] {
				t.Errorf("%s repeats track %s", draft.Name, item.Track.ID)
			}
			seen[item.Track.ID] = true
			sequence += item.Track.ID + "/"
		}
		sequences[sequence] = true
	}
	if len(sequences) != 3 {
		t.Fatalf("expected three distinct sequences, got %d", len(sequences))
	}
	for left := 0; left < len(drafts); left++ {
		for right := left + 1; right < len(drafts); right++ {
			shared := sharedTrackCount(drafts[left], drafts[right])
			limit := min(len(drafts[left].Tracks), len(drafts[right].Tracks)) - 2
			if shared > limit {
				t.Errorf("variations %d and %d only change ordering: %d tracks are shared", left+1, right+1, shared)
			}
		}
	}
}

func sharedTrackCount(left, right domain.SetDraft) int {
	seen := map[string]bool{}
	for _, item := range left.Tracks {
		seen[item.Track.ID] = true
	}
	shared := 0
	for _, item := range right.Tracks {
		if seen[item.Track.ID] {
			shared++
		}
	}
	return shared
}

func TestGenerateIsReproducibleAndHonorsConstraints(t *testing.T) {
	request := domain.GenerateRequest{
		Name:             "Constraint proof",
		DurationMinutes:  45,
		VariationCount:   1,
		Arc:              "roller",
		Exploration:      .4,
		Seed:             42,
		RequiredTrackIDs: []string{"demo-08"},
		ExcludedTrackIDs: []string{"demo-26"},
	}
	one, err := New().Generate(fixtures.Tracks(), request)
	if err != nil {
		t.Fatal(err)
	}
	two, err := New().Generate(fixtures.Tracks(), request)
	if err != nil {
		t.Fatal(err)
	}
	if len(one[0].Tracks) != len(two[0].Tracks) {
		t.Fatal("same seed produced different lengths")
	}
	foundRequired := false
	for i := range one[0].Tracks {
		first, second := one[0].Tracks[i].Track.ID, two[0].Tracks[i].Track.ID
		if first != second {
			t.Fatalf("same seed diverged at %d: %s != %s", i, first, second)
		}
		if first == "demo-08" {
			foundRequired = true
		}
		if first == "demo-26" {
			t.Fatal("excluded track was selected")
		}
	}
	if !foundRequired {
		t.Fatal("required track was not selected")
	}
}

func TestTransitionsExplainRisk(t *testing.T) {
	tracks := fixtures.Tracks()
	smooth := scoreTransition(tracks[0], tracks[1], .8)
	risky := scoreTransition(tracks[0], tracks[35], .8)
	if smooth.Score <= risky.Score {
		t.Fatalf("expected adjacent transition %.3f to beat risky transition %.3f", smooth.Score, risky.Score)
	}
	if len(smooth.Components) != 6 || smooth.Summary == "" {
		t.Fatal("transition explanation is incomplete")
	}
	if smooth.Basis != transitionBasis || smooth.Confidence <= 0 {
		t.Fatalf("transition did not disclose its basis and confidence: %#v", smooth)
	}
	if !strings.Contains(smooth.Summary, "beat-grid validation") {
		t.Fatalf("metadata-only transition overclaims certainty: %q", smooth.Summary)
	}
}

func TestTempoCompatibilityUsesRelativeAndOctaveEquivalentTempo(t *testing.T) {
	score, adjustment, octaveEquivalent := tempoCompatibility(75, 150)
	if score != 1 || adjustment != 0 || !octaveEquivalent {
		t.Fatalf("expected 75→150 to align at double time, got score %.3f adjustment %.2f octave=%v", score, adjustment, octaveEquivalent)
	}

	score, adjustment, octaveEquivalent = tempoCompatibility(125, 150)
	if adjustment < 19.9 || adjustment > 20.1 || octaveEquivalent || score >= .1 {
		t.Fatalf("expected a risky 20%% direct tempo move, got score %.3f adjustment %.2f octave=%v", score, adjustment, octaveEquivalent)
	}
}

func TestLowConfidenceTransitionCannotClaimLowRisk(t *testing.T) {
	from := domain.Track{ID: "from", BPM: 124, Camelot: "8A", Groove: "house", Energy: .6, Vocal: .1, FeatureConfidence: .64}
	to := domain.Track{ID: "to", BPM: 124, Camelot: "8A", Groove: "house", Energy: .62, Vocal: .1, FeatureConfidence: .64}

	transition := scoreTransition(from, to, .8)
	if transition.Risk != "medium" {
		t.Fatalf("low-confidence metadata was labelled %q risk", transition.Risk)
	}
	if transition.Basis != "metadata-only" || transition.Confidence != .64 {
		t.Fatalf("unexpected evidence contract: basis=%q confidence=%.3f", transition.Basis, transition.Confidence)
	}
	if !strings.Contains(transition.Summary, "feature confidence is limited") {
		t.Fatalf("summary did not disclose limited confidence: %q", transition.Summary)
	}
}

func TestDraftScoreCannotAverageAwayHighRiskTransition(t *testing.T) {
	tracks := []domain.Track{
		{ID: "one", DurationSeconds: 300, BPM: 124, Energy: .35, Role: "opener", Artist: "A", Groove: "house", SourcePlaylist: "crate", FeatureConfidence: .95},
		{ID: "two", DurationSeconds: 300, BPM: 125, Energy: .58, Role: "builder", Artist: "B", Groove: "house", SourcePlaylist: "crate", FeatureConfidence: .95},
		{ID: "three", DurationSeconds: 300, BPM: 126, Energy: .78, Role: "closer", Artist: "C", Groove: "house", SourcePlaylist: "crate", FeatureConfidence: .95},
	}
	state := beamState{
		tracks:   tracks,
		duration: 900,
		transitions: []domain.Transition{
			{Score: .96, Risk: "low", Components: []domain.ScoreComponent{{Name: "tempo", Score: .96}, {Name: "harmony", Score: .96}}},
			{Score: .22, Risk: "high", Components: []domain.ScoreComponent{{Name: "tempo", Score: .2}, {Name: "harmony", Score: .3}}},
		},
	}

	draft := buildDraft(state, domain.GenerateRequest{Name: "Weak link", DurationMinutes: 15, Arc: "journey"}, 1, "session")
	if draft.HighRiskTransitions != 1 || draft.QualityScore > 74 {
		t.Fatalf("high-risk edge was hidden: highRisk=%d fit=%.1f", draft.HighRiskTransitions, draft.QualityScore)
	}
	if draft.WeakestTransition != 22 || draft.TransitionSafety != 22 {
		t.Fatalf("weak-link metrics are wrong: weakest=%.1f safety=%.1f", draft.WeakestTransition, draft.TransitionSafety)
	}
	if draft.ScoreVersion != scoreVersion || draft.DurationBasis != "full-track-sum" {
		t.Fatalf("draft lacks scoring provenance: version=%q durationBasis=%q", draft.ScoreVersion, draft.DurationBasis)
	}
}

func TestGenerateRejectsGrossDurationMiss(t *testing.T) {
	tracks := []domain.Track{
		{ID: "one", DurationSeconds: 600, BPM: 124, Camelot: "8A", Groove: "house"},
		{ID: "two", DurationSeconds: 600, BPM: 125, Camelot: "9A", Groove: "house"},
		{ID: "three", DurationSeconds: 600, BPM: 126, Camelot: "10A", Groove: "house"},
	}
	_, err := New().Generate(tracks, domain.GenerateRequest{Name: "Too short", DurationMinutes: 15, VariationCount: 1})
	if err == nil || !strings.Contains(err.Error(), "within 10%") {
		t.Fatalf("expected an honest duration failure, got %v", err)
	}
}

func TestGenerateHonorsGroovePalette(t *testing.T) {
	drafts, err := New().Generate(fixtures.Tracks(), domain.GenerateRequest{
		Name: "techno only", DurationMinutes: 15, VariationCount: 1, Arc: "peak",
		AllowedGrooves: []string{"techno"}, StartBPM: 126, EndBPM: 132, Seed: 73,
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range drafts[0].Tracks {
		if item.Track.Groove != "techno" {
			t.Fatalf("groove filter leaked %q track %s", item.Track.Groove, item.Track.ID)
		}
	}
}

func TestRequiredTracksOverrideGroovePalette(t *testing.T) {
	drafts, err := New().Generate(fixtures.Tracks(), domain.GenerateRequest{
		Name: "techno with a must-play", DurationMinutes: 30, VariationCount: 3, Arc: "journey",
		AllowedGrooves: []string{"techno"}, RequiredTrackIDs: []string{"demo-02"}, Seed: 91,
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, draft := range drafts {
		found := false
		for _, item := range draft.Tracks {
			if item.Track.ID == "demo-02" {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("%s omitted required track outside the selected groove palette", draft.Name)
		}
	}
}
