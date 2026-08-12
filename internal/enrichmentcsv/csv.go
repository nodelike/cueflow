package enrichmentcsv

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	"cueflow/internal/domain"
)

var Header = []string{"track_id", "bpm", "musical_key", "camelot", "energy", "groove", "vocal", "role", "source", "confidence"}

func Parse(reader io.Reader) ([]domain.TrackEnrichment, error) {
	csvReader := csv.NewReader(reader)
	csvReader.TrimLeadingSpace = true
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read enrichment CSV: %w", err)
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("enrichment CSV is empty")
	}
	if len(records[0]) != len(Header) {
		return nil, fmt.Errorf("header must be %s", strings.Join(Header, ","))
	}
	for index := range Header {
		if strings.TrimSpace(records[0][index]) != Header[index] {
			return nil, fmt.Errorf("column %d must be %q", index+1, Header[index])
		}
	}
	result := make([]domain.TrackEnrichment, 0, len(records)-1)
	for rowIndex, row := range records[1:] {
		if len(row) != len(Header) {
			return nil, fmt.Errorf("row %d has %d columns, want %d", rowIndex+2, len(row), len(Header))
		}
		bpm, err := number(row[1], rowIndex+2, "bpm")
		if err != nil {
			return nil, err
		}
		energy, err := number(row[4], rowIndex+2, "energy")
		if err != nil {
			return nil, err
		}
		vocal, err := number(row[6], rowIndex+2, "vocal")
		if err != nil {
			return nil, err
		}
		confidence, err := number(row[9], rowIndex+2, "confidence")
		if err != nil {
			return nil, err
		}
		result = append(result, domain.TrackEnrichment{
			TrackID: strings.TrimSpace(row[0]), BPM: bpm, MusicalKey: strings.TrimSpace(row[2]),
			Camelot: strings.ToUpper(strings.TrimSpace(row[3])), Energy: energy, Groove: strings.TrimSpace(row[5]),
			Vocal: vocal, Role: strings.TrimSpace(row[7]), Source: strings.TrimSpace(row[8]), Confidence: confidence,
		})
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("enrichment CSV has no data rows")
	}
	return result, nil
}

func number(value string, row int, column string) (float64, error) {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, fmt.Errorf("row %d column %s: %w", row, column, err)
	}
	return parsed, nil
}
