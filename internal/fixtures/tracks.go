package fixtures

import (
	"fmt"
	"time"

	"github.com/nodelike/cueflow/internal/domain"
)

type trackSpec struct {
	title, artist, key, camelot, groove, role, source string
	bpm, energy, vocal                                float64
}

// Tracks returns a deliberately varied catalog for development and quality
// tests. The recordings are fictional; their feature combinations are shaped
// like real DJ crates so the generator is exercised without claiming metadata
// about actual releases.
func Tracks() []domain.Track {
	specs := []trackSpec{
		{"Salt Horizon", "Mara Vale", "A minor", "8A", "afro", "opener", "Afro Vibezz", 116, .28, .12},
		{"Clay Drums", "Nilo & Sefa", "E minor", "9A", "afro", "builder", "Afro Vibezz", 117, .34, .05},
		{"Amber Courtyard", "Solis K", "B minor", "10A", "afro", "builder", "Afro Vibezz", 118, .39, .42},
		{"Night Market Voices", "Ayo North", "F# minor", "11A", "afro", "vocal", "Afro Vibezz", 119, .44, .76},
		{"Copper Rain", "Mara Vale", "C# minor", "12A", "afro", "bridge", "Afro Vibezz", 120, .48, .08},
		{"River Glyph", "Tamba System", "G# minor", "1A", "tribal", "builder", "Afro Vibezz", 121, .53, .18},
		{"Palm Signal", "Lewa", "D# minor", "2A", "tribal", "lifter", "Afro Vibezz", 122, .59, .35},
		{"Red Earth Radio", "Nilo & Sefa", "A# minor", "3A", "tribal", "vocal", "Afro Vibezz", 123, .64, .71},
		{"After the Dust", "Tamba System", "F minor", "4A", "tribal", "peak", "Afro Vibezz", 124, .72, .16},
		{"Sunline Reprise", "Ayo North", "C minor", "5A", "afro", "closer", "Afro Vibezz", 122, .55, .48},

		{"Lobby Lights", "June Assembly", "C major", "8B", "house", "opener", "House Vibezz", 120, .31, .22},
		{"Soft Focus", "Arden Club", "G major", "9B", "house", "builder", "House Vibezz", 121, .38, .54},
		{"Window Seat", "Leisure Index", "D major", "10B", "house", "vocal", "House Vibezz", 122, .44, .73},
		{"Chrome Hibiscus", "June Assembly", "A major", "11B", "house", "bridge", "House Vibezz", 123, .49, .11},
		{"Borrowed Summer", "Arden Club", "E major", "12B", "house", "lifter", "House Vibezz", 124, .58, .62},
		{"Mirrorball Transit", "Leisure Index", "B major", "1B", "house", "builder", "House Vibezz", 125, .62, .19},
		{"High Street Heat", "June Assembly", "F# major", "2B", "house", "peak", "House Vibezz", 126, .74, .37},
		{"Every Room", "Nia Bloom", "Db major", "3B", "house", "vocal", "House Vibezz", 125, .68, .82},
		{"Glass Elevator", "Arden Club", "Ab major", "4B", "house", "reset", "House Vibezz", 123, .50, .08},
		{"Last Train Gold", "Nia Bloom", "Eb major", "5B", "house", "closer", "House Vibezz", 124, .57, .58},

		{"Rubber Soul", "Parcel Unit", "F minor", "4A", "tech-house", "opener", "Tech House Vibezz", 124, .45, .10},
		{"Side Door", "Kepler Twins", "C minor", "5A", "tech-house", "builder", "Tech House Vibezz", 125, .52, .18},
		{"Pressure Dial", "Low Relay", "G minor", "6A", "tech-house", "builder", "Tech House Vibezz", 126, .59, .06},
		{"Say Less", "Parcel Unit", "D minor", "7A", "tech-house", "vocal", "Tech House Vibezz", 126, .64, .74},
		{"Floor Magnet", "Kepler Twins", "A minor", "8A", "tech-house", "lifter", "Tech House Vibezz", 127, .70, .14},
		{"Blue Strobe", "Low Relay", "E minor", "9A", "tech-house", "peak", "Tech House Vibezz", 128, .79, .08},
		{"One More Signal", "Parcel Unit", "B minor", "10A", "tech-house", "vocal", "Tech House Vibezz", 128, .82, .67},
		{"Latch Key", "Kepler Twins", "F# minor", "11A", "tech-house", "peak", "Tech House Vibezz", 129, .87, .12},
		{"Concrete Bloom", "Low Relay", "C# minor", "12A", "tech-house", "reset", "Tech House Vibezz", 126, .61, .04},
		{"Exit Through Sound", "Parcel Unit", "G# minor", "1A", "tech-house", "closer", "Tech House Vibezz", 127, .70, .31},

		{"Below Platform", "Vector Field", "D minor", "7A", "techno", "opener", "Techno Vibezz", 126, .53, .03},
		{"Black Conveyor", "Orris", "A minor", "8A", "techno", "builder", "Techno Vibezz", 127, .61, .02},
		{"Static Architecture", "Vector Field", "E minor", "9A", "techno", "builder", "Techno Vibezz", 128, .68, .04},
		{"Machine Memory", "Kern Array", "B minor", "10A", "techno", "lifter", "Techno Vibezz", 129, .74, .09},
		{"Laser Quarry", "Orris", "F# minor", "11A", "techno", "peak", "Techno Vibezz", 130, .84, .02},
		{"Cold Geometry", "Vector Field", "C# minor", "12A", "techno", "peak", "Techno Vibezz", 131, .90, .01},
		{"Redline Bloom", "Kern Array", "G# minor", "1A", "techno", "peak", "Techno Vibezz", 132, .95, .03},
		{"Vacuum Choir", "Orris", "D# minor", "2A", "techno", "reset", "Techno Vibezz", 129, .69, .21},
		{"Terminal Pulse", "Vector Field", "A# minor", "3A", "techno", "lifter", "Techno Vibezz", 133, .91, .05},
		{"Dawn Circuit", "Kern Array", "F minor", "4A", "techno", "closer", "Techno Vibezz", 128, .72, .15},
	}

	base := time.Date(2026, 8, 7, 10, 0, 0, 0, time.UTC)
	tracks := make([]domain.Track, 0, len(specs))
	for i, spec := range specs {
		tracks = append(tracks, domain.Track{
			ID:                fmt.Sprintf("demo-%02d", i+1),
			Title:             spec.title,
			Artist:            spec.artist,
			DurationSeconds:   270 + (i%6)*24,
			BPM:               spec.bpm,
			MusicalKey:        spec.key,
			Camelot:           spec.camelot,
			Energy:            spec.energy,
			Groove:            spec.groove,
			Vocal:             spec.vocal,
			Role:              spec.role,
			SourcePlaylist:    spec.source,
			AddedAt:           base.Add(time.Duration(i) * 3 * time.Hour),
			FeatureConfidence: .92,
			FeatureProvenance: "Cueflow reference fixture",
		})
	}
	return tracks
}
