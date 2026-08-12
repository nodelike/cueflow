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
