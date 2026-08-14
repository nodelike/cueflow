package generator

import (
	"fmt"
	"math"

	"github.com/nodelike/cueflow/internal/domain"
)

func scoreTransitionWithAnalyses(from, to domain.Track, analyses map[string]domain.TrackAnalysis, strictness float64) domain.Transition {
	metadata := scoreTransition(from, to, strictness)
	fromAnalysis, fromOK := analyses[from.ID]
	toAnalysis, toOK := analyses[to.ID]
	if !fromOK || !toOK {
		return metadata
	}

	plan, ok := bestTransitionPlan(fromAnalysis, toAnalysis)
	if !ok {
		return metadata
	}
	tempoScore, tempoAdjustment, octaveEquivalent := tempoCompatibility(fromAnalysis.TempoBPM, toAnalysis.TempoBPM)
	for index := range metadata.Components {
		if metadata.Components[index].Name == "tempo" {
			metadata.Components[index].Score = round(tempoScore, 3)
			metadata.Components[index].Note = fmt.Sprintf("%.1f%% adjustment from full-track beat analysis", tempoAdjustment)
			if octaveEquivalent {
				metadata.Components[index].Note += " using a half/double-time interpretation"
			}
		}
	}
	metadata.Components = append(metadata.Components, plan.Components...)
	metadata.Score = round(clamp01(metadata.Score*.38+plan.Score*.62), 3)
	metadata.Basis = "temporal"
	metadata.TempoAdjustmentPct = round(tempoAdjustment, 2)
	metadata.TempoOctaveEquivalent = octaveEquivalent
	metadata.Confidence = round(math.Min(metadata.Confidence, plan.Confidence), 3)
	temporalRisk := maxRisk(plan.Risk, transitionRisk(metadata.Score, tempoAdjustment, metadata.Confidence, componentScore(metadata.Components, "cue vocals")))
	metadata.Risk = maxRisk(metadata.Risk, temporalRisk)
	metadata.Summary = fmt.Sprintf(
		"%d-bar %s candidate using %s → %s; waveform/STFT window checks scored %.0f/100; rendered-audio validation is still required",
		plan.Bars, plan.Style, plan.FromCueID, plan.ToCueID, plan.Score*100,
	)
	metadata.Plan = &plan
	return metadata
}

func bestTransitionPlan(from, to domain.TrackAnalysis) (domain.TransitionPlan, bool) {
	best := domain.TransitionPlan{}
	found := false
	for _, outgoing := range from.CueCandidates {
		if !outgoingCue(outgoing.Kind) {
			continue
		}
		for _, incoming := range to.CueCandidates {
			if !incomingCue(incoming.Kind) {
				continue
			}
			plan := buildTransitionPlan(from, to, outgoing, incoming)
			if !found || plan.Score > best.Score || (plan.Score == best.Score && plan.Confidence > best.Confidence) {
				best, found = plan, true
			}
		}
	}
	return best, found
}

func buildTransitionPlan(from, to domain.TrackAnalysis, outgoing, incoming domain.CueCandidate) domain.TransitionPlan {
	tempo, adjustment, _ := tempoCompatibility(from.TempoBPM, to.TempoBPM)
	phrase := float64(min(outgoing.Bars, incoming.Bars)) / float64(max(outgoing.Bars, incoming.Bars))
	bassRaw := clamp01(1 - math.Max(0, outgoing.Metrics.LowEnergy+incoming.Metrics.LowEnergy-.82)/.82)
	// The generated low-EQ exchange handles part, but not all, of a bass clash.
	bass := .62 + bassRaw*.38
	vocals := clamp01(1 - outgoing.Metrics.VocalProbability*incoming.Metrics.VocalProbability*1.25)
	loudness := clamp01(math.Exp(-math.Abs(outgoing.Metrics.LoudnessLUFS-incoming.Metrics.LoudnessLUFS) / 6))
	percussion := clamp01(1 - math.Abs(outgoing.Metrics.PercussiveStrength-incoming.Metrics.PercussiveStrength))
	tonal := chromaCompatibility(outgoing.Metrics, incoming.Metrics)
	confidence := minFloat(from.TempoConfidence, to.TempoConfidence, outgoing.Confidence, incoming.Confidence)
	toTrim := clamp(outgoing.Metrics.LoudnessLUFS-incoming.Metrics.LoudnessLUFS, -9, 3)
	predictedPeak := math.Sqrt(.5) * (outgoing.Metrics.Peak + incoming.Metrics.Peak*math.Pow(10, toTrim/20))
	headroom := clamp01(1 - math.Max(0, predictedPeak-.98)/.5)
	score := tempo*.15 + phrase*.17 + bass*.14 + vocals*.17 + loudness*.11 + percussion*.08 + tonal*.08 + headroom*.10
	score = clamp01(score * (.72 + confidence*.28))
	risk := transitionRisk(score, adjustment, confidence, vocals)
	if headroom < .3 {
		risk = maxRisk(risk, "high")
	} else if headroom < .65 {
		risk = maxRisk(risk, "medium")
	}

	style := "long-blend"
	switch {
	case vocals < .45:
		style = "echo-out"
	case bassRaw < .45:
		style = "bass-swap"
	case tonal < .45 && percussion > .7:
		style = "drum-led"
	case incoming.Kind == domain.CueKindDrop:
		style = "drop-swap"
	}
	bars := min(outgoing.Bars, incoming.Bars)
	bassSwapBar := max(1, bars/2)
	predictedPeakDBFS := 20 * math.Log10(math.Max(predictedPeak, 1e-9))

	components := []domain.ScoreComponent{
		{Name: "cue phrase", Score: round(phrase, 3), Note: fmt.Sprintf("%d-bar exit against %d-bar entry", outgoing.Bars, incoming.Bars)},
		{Name: "cue bass", Score: round(bass, 3), Note: fmt.Sprintf("low-band overlap before planned EQ exchange: %.0f%%", (1-bassRaw)*100)},
		{Name: "cue vocals", Score: round(vocals, 3), Note: "time-local vocal-overlap estimate"},
		{Name: "cue loudness", Score: round(loudness, 3), Note: fmt.Sprintf("incoming trim proposal %+.1f dB", toTrim)},
		{Name: "cue percussion", Score: round(percussion, 3), Note: "time-local percussive continuity"},
		{Name: "cue tonality", Score: round(tonal, 3), Note: "time-local chroma compatibility"},
		{Name: "cue headroom", Score: round(headroom, 3), Note: fmt.Sprintf("waveform peaks predict %+.1f dBFS at constant-power midpoint", predictedPeakDBFS)},
	}
	return domain.TransitionPlan{
		Version:            domain.TransitionPlanVersion,
		FromCueID:          outgoing.ID,
		ToCueID:            incoming.ID,
		Style:              style,
		Bars:               bars,
		FromStartSeconds:   outgoing.StartSeconds,
		FromEndSeconds:     outgoing.EndSeconds,
		ToStartSeconds:     incoming.StartSeconds,
		ToEndSeconds:       incoming.EndSeconds,
		TempoAdjustmentPct: round(adjustment, 2),
		BassSwapBar:        bassSwapBar,
		Score:              round(score, 3),
		Risk:               risk,
		Confidence:         round(confidence, 3),
		Components:         components,
		Automation: []domain.AutomationLane{
			{Target: "crossfader", Points: []domain.AutomationPoint{{Bar: 0, Value: -1}, {Bar: float64(bassSwapBar), Value: 0}, {Bar: float64(bars), Value: 1}}},
			{Target: "from-low-eq-db", Points: []domain.AutomationPoint{{Bar: 0, Value: 0}, {Bar: float64(bassSwapBar), Value: -24}, {Bar: float64(bars), Value: -60}}},
			{Target: "to-low-eq-db", Points: []domain.AutomationPoint{{Bar: 0, Value: -60}, {Bar: float64(bassSwapBar), Value: -24}, {Bar: float64(min(bars, bassSwapBar+2)), Value: 0}}},
			{Target: "to-trim-db", Points: []domain.AutomationPoint{{Bar: 0, Value: round(toTrim, 2)}, {Bar: float64(bars), Value: round(toTrim, 2)}}},
		},
		Notes: []string{
			"snap both cues to verified downbeats before rendering",
			"validate true peak, integrated/short-term loudness, masking, phase, and time-stretch artifacts on the rendered overlap",
		},
		RenderValidationRequired: true,
	}
}

func outgoingCue(kind string) bool {
	return kind == domain.CueKindPhraseOut || kind == domain.CueKindOutro || kind == domain.CueKindBreakdown
}

func incomingCue(kind string) bool {
	return kind == domain.CueKindIntro || kind == domain.CueKindPhraseIn || kind == domain.CueKindBreakdown || kind == domain.CueKindDrop
}

func chromaCompatibility(from, to domain.CueWindowMetrics) float64 {
	if len(from.Chroma) != 12 || len(to.Chroma) != 12 || from.TonalStrength < .25 || to.TonalStrength < .25 {
		return .72
	}
	dot, fromMagnitude, toMagnitude := 0.0, 0.0, 0.0
	for index := 0; index < 12; index++ {
		dot += from.Chroma[index] * to.Chroma[index]
		fromMagnitude += from.Chroma[index] * from.Chroma[index]
		toMagnitude += to.Chroma[index] * to.Chroma[index]
	}
	if fromMagnitude == 0 || toMagnitude == 0 {
		return .72
	}
	return clamp01(dot / math.Sqrt(fromMagnitude*toMagnitude))
}

func temporalCoverage(transitions []domain.Transition) float64 {
	if len(transitions) == 0 {
		return 0
	}
	temporal := 0
	for _, transition := range transitions {
		if transition.Basis == "temporal" && transition.Plan != nil {
			temporal++
		}
	}
	return float64(temporal) / float64(len(transitions))
}

func temporalConfidence(transitions []domain.Transition) float64 {
	total, count := 0.0, 0
	for _, transition := range transitions {
		if transition.Basis == "temporal" && transition.Plan != nil {
			total += transition.Plan.Confidence
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return total / float64(count)
}

func componentScore(components []domain.ScoreComponent, name string) float64 {
	for _, component := range components {
		if component.Name == name {
			return component.Score
		}
	}
	return .5
}

func minFloat(values ...float64) float64 {
	result := values[0]
	for _, value := range values[1:] {
		result = math.Min(result, value)
	}
	return result
}

func clamp(value, minimum, maximum float64) float64 {
	return math.Max(minimum, math.Min(maximum, value))
}
