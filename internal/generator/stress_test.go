package generator

import (
	"fmt"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/nodelike/cueflow/internal/domain"
)

func TestGeneratorStressCatalog(t *testing.T) {
	catalog := stressCatalog(120, 20260813)
	qualityTotal, draftCount, transitionCount, highRisk := 0.0, 0, 0, 0
	for _, arc := range []string{"journey", "roller", "peak", "sunset"} {
		for seed := int64(1); seed <= 3; seed++ {
			drafts, err := New().Generate(catalog, domain.GenerateRequest{
				Name: "stress", DurationMinutes: 75, VariationCount: 4, Arc: arc,
				HarmonicStrictness: .78, Exploration: .4, StartBPM: 118, EndBPM: 132, Seed: seed,
			})
			if err != nil {
				t.Fatalf("%s seed %d: %v", arc, seed, err)
			}
			assertDistinct(t, drafts)
			for _, draft := range drafts {
				qualityTotal += draft.QualityScore
				draftCount++
				for _, item := range draft.Tracks[1:] {
					transitionCount++
					if item.Transition.Risk == "high" {
						highRisk++
					}
				}
			}
		}
	}
	average := qualityTotal / float64(draftCount)
	riskRate := float64(highRisk) / float64(transitionCount)
	t.Logf("stress catalog: %d drafts, average %.1f, high-risk transitions %.1f%%", draftCount, average, riskRate*100)
	if average < 75 {
		t.Errorf("stress-catalog average %.1f below 75", average)
	}
	if riskRate > .12 {
		t.Errorf("stress-catalog high-risk rate %.1f%% exceeds 12%%", riskRate*100)
	}
}

func stressCatalog(count int, seed uint64) []domain.Track {
	rng := rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))
	grooves := []string{"afro", "tribal", "house", "tech-house", "techno"}
	sources := []string{"Afro Vibezz", "House Vibezz", "Tech House Vibezz", "Techno Vibezz"}
	tracks := make([]domain.Track, 0, count)
	for index := 0; index < count; index++ {
		energy := .2 + rng.Float64()*.78
		role := "builder"
		switch {
		case energy < .35:
			role = "opener"
		case energy > .86:
			role = "peak"
		case index%13 == 0:
			role = "reset"
		case index%17 == 0:
			role = "closer"
		case energy > .68:
			role = "lifter"
		}
		keyNumber := 1 + rng.IntN(12)
		keyMode := byte('A')
		if rng.IntN(3) == 0 {
			keyMode = 'B'
		}
		tracks = append(tracks, domain.Track{
			ID: fmt.Sprintf("stress-%03d", index), Title: fmt.Sprintf("Stress Track %03d", index),
			Artist: fmt.Sprintf("Artist %02d", index%23), DurationSeconds: 240 + rng.IntN(181),
			BPM: 116 + rng.Float64()*19, MusicalKey: "verified", Camelot: fmt.Sprintf("%d%c", keyNumber, keyMode),
			Energy: energy, Groove: grooves[rng.IntN(len(grooves))], Vocal: rng.Float64(), Role: role,
			SourcePlaylist: sources[index%len(sources)], AddedAt: time.Unix(int64(index*3600), 0).UTC(),
			FeatureConfidence: .85, FeatureProvenance: "synthetic stress fixture",
		})
	}
	return tracks
}
