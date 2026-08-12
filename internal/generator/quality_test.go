package generator

import (
	"fmt"
	"math"
	"testing"

	"cueflow/internal/domain"
	"cueflow/internal/fixtures"
)

func TestQualityMatrix(t *testing.T) {
	arcs := []string{"journey", "roller", "peak", "sunset"}
	durations := []int{45, 60, 90}
	totalQuality, draftCount, highRiskCount, transitionCount := 0.0, 0, 0, 0
	worstQuality := 100.0
	for _, arc := range arcs {
		for _, duration := range durations {
			for seed := int64(1); seed <= 5; seed++ {
				request := domain.GenerateRequest{
					Name: "quality matrix", DurationMinutes: duration, VariationCount: 3,
					Arc: arc, HarmonicStrictness: .74, Exploration: .32,
					StartBPM: 117, EndBPM: map[bool]float64{true: 131, false: 127}[arc == "peak"], Seed: seed,
				}
				drafts, err := New().Generate(fixtures.Tracks(), request)
				if err != nil {
					t.Fatalf("%s %dm seed %d: %v", arc, duration, seed, err)
				}
				assertDistinct(t, drafts)
				for _, draft := range drafts {
					draftCount++
					totalQuality += draft.QualityScore
					worstQuality = math.Min(worstQuality, draft.QualityScore)
					if draft.QualityScore < 68 {
						t.Errorf("%s %dm seed %d quality %.1f below floor", arc, duration, seed, draft.QualityScore)
					}
					allowedError := math.Max(12*60, float64(duration*60)*.22)
					if math.Abs(float64(draft.DurationSeconds-duration*60)) > allowedError {
						t.Errorf("%s duration misses target: %ds", draft.Name, draft.DurationSeconds)
					}
					seen := map[string]bool{}
					for _, item := range draft.Tracks {
						if seen[item.Track.ID] {
							t.Errorf("%s repeats %s", draft.Name, item.Track.ID)
						}
						seen[item.Track.ID] = true
						if item.Position > 1 {
							transitionCount++
							if item.Transition.Risk == "high" {
								highRiskCount++
							}
						}
					}
				}
			}
		}
	}
	average := totalQuality / float64(draftCount)
	riskRate := float64(highRiskCount) / float64(transitionCount)
	t.Logf("quality matrix: %d drafts, average %.1f, worst %.1f, high-risk transitions %.1f%%", draftCount, average, worstQuality, riskRate*100)
	if average < 79 {
		t.Errorf("average quality %.1f below target", average)
	}
	if riskRate > .08 {
		t.Errorf("high-risk transition rate %.1f%% exceeds target", riskRate*100)
	}
}

func assertDistinct(t *testing.T, drafts []domain.SetDraft) {
	t.Helper()
	sequences := map[string]bool{}
	for _, draft := range drafts {
		sequence := ""
		for _, item := range draft.Tracks {
			sequence += fmt.Sprintf("%s/", item.Track.ID)
		}
		sequences[sequence] = true
	}
	if len(sequences) != len(drafts) {
		t.Errorf("only %d of %d variations are distinct", len(sequences), len(drafts))
	}
	for left := 0; left < len(drafts); left++ {
		for right := left + 1; right < len(drafts); right++ {
			shared := sharedTrackCount(drafts[left], drafts[right])
			limit := min(len(drafts[left].Tracks), len(drafts[right].Tracks)) - 2
			if shared > limit {
				t.Errorf("variations %d and %d share %d tracks; at least two substitutions are required", left+1, right+1, shared)
			}
		}
	}
}
