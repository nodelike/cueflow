package enrichmentcsv

import (
	"strings"
	"testing"
)

func TestParse(t *testing.T) {
	input := `track_id,bpm,musical_key,camelot,energy,groove,vocal,role,source,confidence
spotify-1,127.8,A minor,8a,0.81,rolling,0.2,driver,manual audio review,0.93
`
	rows, err := Parse(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].TrackID != "spotify-1" || rows[0].Camelot != "8A" || rows[0].BPM != 127.8 {
		t.Fatalf("unexpected parse: %#v", rows)
	}
}

func TestParseRejectsBadHeaderAndNumber(t *testing.T) {
	if _, err := Parse(strings.NewReader("track,bpm\n")); err == nil {
		t.Fatal("expected header error")
	}
	input := `track_id,bpm,musical_key,camelot,energy,groove,vocal,role,source,confidence
spotify-1,fast,A minor,8A,0.8,rolling,0.2,driver,review,0.9
`
	if _, err := Parse(strings.NewReader(input)); err == nil {
		t.Fatal("expected number error")
	}
}
