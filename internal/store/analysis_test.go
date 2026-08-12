package store

import (
	"testing"
	"time"

	"cueflow/internal/fixtures"
)

func TestAnalysisDurationCompatibilityRejectsPreviewEvidence(t *testing.T) {
	if compatible, _ := analysisDurationCompatible(360, 30); compatible {
		t.Fatal("30-second preview was accepted as a six-minute full-track analysis")
	}
	if compatible, tolerance := analysisDurationCompatible(360, 355); !compatible || tolerance != 7.2 {
		t.Fatalf("expected a five-second container-duration difference to pass: compatible=%v tolerance=%.1f", compatible, tolerance)
	}
}

func TestAnalysisContentIdentityIgnoresTimestampButNotEvidence(t *testing.T) {
	analysis := storeAnalysisFixture(fixtures.Tracks()[0])
	first, err := analysisContentHash(analysis)
	if err != nil {
		t.Fatal(err)
	}
	runAgain := analysis
	runAgain.AnalyzedAt = runAgain.AnalyzedAt.Add(24 * time.Hour)
	second, err := analysisContentHash(runAgain)
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatal("rerun timestamp changed the evidence identity")
	}
	runAgain.TempoBPM++
	changed, err := analysisContentHash(runAgain)
	if err != nil {
		t.Fatal(err)
	}
	if changed == first {
		t.Fatal("changed evidence retained the same content identity")
	}
}
