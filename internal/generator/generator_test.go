package generator

import (
	"math"
	"strings"
	"testing"
	"time"

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

func TestFieldFeedbackOverridesTheHeuristicForAnExactTrackOrder(t *testing.T) {
	transition := domain.Transition{
		FromTrackID: "one", ToTrackID: "two", Score: .74, Risk: "medium", Summary: "heuristic estimate",
		Components: []domain.ScoreComponent{{Name: "tempo", Score: .8}},
	}
	compatible := applyTransitionFeedback(transition, domain.TransitionFeedback{
		FromTrackID: "one", ToTrackID: "two", Verdict: domain.TransitionVerdictCompatible,
	})
	if compatible.Score != .9 || compatible.Risk != "low" || !strings.Contains(compatible.Summary, "field test") {
		t.Fatalf("compatible field test was not applied: %#v", compatible)
	}
	if last := compatible.Components[len(compatible.Components)-1]; last.Name != "field test" || last.Score != 1 {
		t.Fatalf("compatible transition lacks field evidence: %#v", compatible.Components)
	}

	incompatible := applyTransitionFeedback(transition, domain.TransitionFeedback{
		FromTrackID: "one", ToTrackID: "two", Verdict: domain.TransitionVerdictIncompatible,
	})
	if incompatible.Score != .1 || incompatible.Risk != "high" || !strings.Contains(incompatible.Summary, "clashes") {
		t.Fatalf("incompatible field test was not applied: %#v", incompatible)
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

func TestTemporalAnalysisProducesExecutableCuePlan(t *testing.T) {
	from := domain.Track{ID: "from", DurationSeconds: 300, BPM: 124, Camelot: "8A", Groove: "house", Energy: .6, Vocal: .1, FeatureConfidence: .95}
	to := domain.Track{ID: "to", DurationSeconds: 300, BPM: 125, Camelot: "9A", Groove: "house", Energy: .64, Vocal: .1, FeatureConfidence: .95}
	analyses := map[string]domain.TrackAnalysis{
		from.ID: temporalAnalysisFixture(from, 124),
		to.ID:   temporalAnalysisFixture(to, 125),
	}

	transition := scoreTransitionWithAnalyses(from, to, analyses, .8)
	if transition.Basis != "temporal" || transition.Plan == nil {
		t.Fatalf("temporal evidence did not produce a cue plan: %#v", transition)
	}
	if transition.Plan.Version != domain.TransitionPlanVersion || !transition.Plan.RenderValidationRequired {
		t.Fatalf("plan lacks version/render gate: %#v", transition.Plan)
	}
	if transition.Plan.FromCueID != "from-out" || transition.Plan.ToCueID != "to-in" || transition.Plan.Bars != 16 {
		t.Fatalf("wrong cue pair selected: %#v", transition.Plan)
	}
	if len(transition.Plan.Automation) < 4 || !strings.Contains(transition.Summary, "rendered-audio validation") {
		t.Fatalf("plan is not executable or overclaims validation: %#v", transition.Plan)
	}
	if componentScore(transition.Plan.Components, "cue headroom") <= 0 {
		t.Fatalf("waveform-derived peak headroom was not scored: %#v", transition.Plan.Components)
	}
	metadataConflict := to
	metadataConflict.BPM = 150
	if conflict := scoreTransitionWithAnalyses(from, metadataConflict, analyses, .8); conflict.Risk != "high" {
		t.Fatalf("temporal evidence improperly downgraded a high-risk metadata conflict: %#v", conflict)
	}
	if fallback := scoreTransitionWithAnalyses(from, to, map[string]domain.TrackAnalysis{from.ID: analyses[from.ID]}, .8); fallback.Basis != "metadata-only" || fallback.Plan != nil {
		t.Fatalf("one-sided analysis was presented as temporal evidence: %#v", fallback)
	}
}

func TestTransitionPlanStyleRespondsToLocalWindowConflicts(t *testing.T) {
	track := domain.Track{ID: "style", DurationSeconds: 300, BPM: 124}
	analysis := temporalAnalysisFixture(track, 124)
	outgoing, incoming := analysis.CueCandidates[1], analysis.CueCandidates[0]

	vocalOut, vocalIn := outgoing, incoming
	vocalOut.Metrics.VocalProbability, vocalIn.Metrics.VocalProbability = .9, .9
	if plan := buildTransitionPlan(analysis, analysis, vocalOut, vocalIn); plan.Style != "echo-out" {
		t.Fatalf("vocal collision selected %q instead of echo-out", plan.Style)
	}

	bassOut, bassIn := outgoing, incoming
	bassOut.Metrics.LowEnergy, bassIn.Metrics.LowEnergy = .9, .9
	bassOut.Metrics.VocalProbability, bassIn.Metrics.VocalProbability = .05, .05
	if plan := buildTransitionPlan(analysis, analysis, bassOut, bassIn); plan.Style != "bass-swap" {
		t.Fatalf("bass collision selected %q instead of bass-swap", plan.Style)
	}

	dropIn := incoming
	dropIn.Kind = domain.CueKindDrop
	if plan := buildTransitionPlan(analysis, analysis, outgoing, dropIn); plan.Style != "drop-swap" {
		t.Fatalf("clean drop entry selected %q instead of drop-swap", plan.Style)
	}

	clippedOut, clippedIn := outgoing, incoming
	clippedOut.Metrics.Peak, clippedIn.Metrics.Peak = 1, 1
	if plan := buildTransitionPlan(analysis, analysis, clippedOut, clippedIn); plan.Risk != "high" || componentScore(plan.Components, "cue headroom") >= .3 {
		t.Fatalf("predicted waveform-peak collision was not high risk: %#v", plan)
	}
}

func TestGenerateReportsTemporalCoverage(t *testing.T) {
	catalog := fixtures.Tracks()
	analyses := make(map[string]domain.TrackAnalysis, len(catalog))
	for _, track := range catalog {
		analyses[track.ID] = temporalAnalysisFixture(track, track.BPM)
	}
	drafts, err := New().GenerateWithAnalyses(catalog, analyses, domain.GenerateRequest{
		Name: "Temporal", DurationMinutes: 15, VariationCount: 1, Arc: "journey", StartBPM: 118, EndBPM: 125, Seed: 44,
	})
	if err != nil {
		t.Fatal(err)
	}
	if drafts[0].TemporalCoverage != 100 || drafts[0].TemporalConfidence != 90 || !strings.Contains(drafts[0].ScoreVersion, domain.TransitionPlanVersion) {
		t.Fatalf("draft did not disclose temporal evidence: coverage=%.1f confidence=%.1f version=%q", drafts[0].TemporalCoverage, drafts[0].TemporalConfidence, drafts[0].ScoreVersion)
	}
	for _, item := range drafts[0].Tracks[1:] {
		if item.Transition.Basis != "temporal" || item.Transition.Plan == nil {
			t.Fatalf("track %d fell back to metadata despite full coverage", item.Position)
		}
	}
}

func temporalAnalysisFixture(track domain.Track, tempo float64) domain.TrackAnalysis {
	duration := float64(track.DurationSeconds)
	metrics := domain.CueWindowMetrics{
		LoudnessLUFS: -11, Peak: .72, LowEnergy: .42, MidEnergy: .5, HighEnergy: .3,
		PercussiveStrength: .78, VocalProbability: .12, TonalStrength: .4,
		Chroma: []float64{1, .1, 0, 0, .3, 0, 0, .5, 0, 0, 0, 0},
	}
	return domain.TrackAnalysis{
		SchemaVersion: domain.TemporalAnalysisSchemaVersion, TrackID: track.ID,
		AudioFingerprint: "sha256:" + track.ID, AnalyzerVersion: "test-analyzer/1",
		DurationSeconds: duration, SampleRate: 44100, Channels: 2, TempoBPM: tempo, TempoConfidence: .94,
		Waveform: []domain.WaveformPoint{{StartSeconds: 0, EndSeconds: duration, RMS: .24, Peak: .72}},
		Beats: []domain.BeatMarker{
			{TimeSeconds: 0, BeatInBar: 1, BarIndex: 0, Confidence: .95},
			{TimeSeconds: .5, BeatInBar: 2, BarIndex: 0, Confidence: .95},
		},
		Sections: []domain.AudioSection{{ID: track.ID + "-section", Label: "full", StartSeconds: 0, EndSeconds: duration, Confidence: .8}},
		Frames:   []domain.AnalysisFrame{{StartSeconds: 0, EndSeconds: 1, RMS: .24, Peak: .72, LoudnessLUFS: -11, LowEnergy: .42, MidEnergy: .5, HighEnergy: .3, SpectralFlux: .4, PercussiveStrength: .78, VocalProbability: .12, TonalStrength: .4, Chroma: metrics.Chroma}},
		CueCandidates: []domain.CueCandidate{
			{ID: "to-in", Kind: domain.CueKindIntro, StartSeconds: 0, EndSeconds: math.Min(64, duration), BeatIndex: 0, BarIndex: 0, Bars: 16, Confidence: .9, Metrics: metrics},
			{ID: "from-out", Kind: domain.CueKindOutro, StartSeconds: math.Max(0, duration-64), EndSeconds: duration, BeatIndex: 0, BarIndex: 0, Bars: 16, Confidence: .9, Metrics: metrics},
		},
		AnalyzedAt: time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC),
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
