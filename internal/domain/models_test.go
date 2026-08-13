package domain

import "testing"

func TestGenerateRequestDefaultsPreserveExplicitZeroControls(t *testing.T) {
	request := GenerateRequest{HarmonicStrictness: 0, Exploration: 0}.WithDefaults()
	if request.HarmonicStrictness != 0 || request.Exploration != 0 {
		t.Fatalf("explicit zero controls were overwritten: strictness=%.2f exploration=%.2f", request.HarmonicStrictness, request.Exploration)
	}
	if request.DurationMinutes != 60 || request.VariationCount != 3 || request.Arc != "journey" {
		t.Fatalf("unrelated defaults were not applied: %#v", request)
	}
}

func TestTransitionFeedbackValidation(t *testing.T) {
	valid := TransitionFeedback{FromTrackID: "one", ToTrackID: "two", Verdict: TransitionVerdictCompatible}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid feedback was rejected: %v", err)
	}
	for _, invalid := range []TransitionFeedback{
		{ToTrackID: "two", Verdict: TransitionVerdictCompatible},
		{FromTrackID: "one", ToTrackID: "one", Verdict: TransitionVerdictCompatible},
		{FromTrackID: "one", ToTrackID: "two", Verdict: "maybe"},
	} {
		if err := invalid.Validate(); err == nil {
			t.Fatalf("invalid feedback was accepted: %#v", invalid)
		}
	}
}
