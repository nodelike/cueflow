package generator

import (
	"math"
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
	if len(smooth.Components) != 5 || smooth.Summary == "" {
		t.Fatal("transition explanation is incomplete")
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
