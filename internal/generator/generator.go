package generator

import (
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"sort"
	"strconv"
	"strings"
	"time"

	"cueflow/internal/domain"

	"github.com/google/uuid"
)

const (
	beamWidth   = 42
	branchWidth = 14
)

type Generator struct{}

func New() *Generator { return &Generator{} }

type beamState struct {
	tracks      []domain.Track
	transitions []domain.Transition
	used        map[string]bool
	duration    int
	score       float64
}

type candidate struct {
	track      domain.Track
	transition domain.Transition
	score      float64
}

func (g *Generator) Generate(catalog []domain.Track, input domain.GenerateRequest) ([]domain.SetDraft, error) {
	req := input.WithDefaults()
	if len(catalog) < 3 {
		return nil, fmt.Errorf("at least three tracks are required")
	}
	if req.DurationMinutes < 15 || req.DurationMinutes > 240 {
		return nil, fmt.Errorf("duration must be between 15 and 240 minutes")
	}
	if req.HarmonicStrictness < 0 || req.HarmonicStrictness > 1 || req.Exploration < 0 || req.Exploration > 1 {
		return nil, fmt.Errorf("strictness and exploration must be between 0 and 1")
	}

	excluded := makeSet(req.ExcludedTrackIDs)
	allowedGrooves := makeSet(req.AllowedGrooves)
	pool := make([]domain.Track, 0, len(catalog))
	for _, track := range catalog {
		grooveAllowed := len(allowedGrooves) == 0 || allowedGrooves[track.Groove]
		if grooveAllowed && !excluded[track.ID] && track.DurationSeconds > 0 && track.BPM > 0 && track.Camelot != "" && !track.FeatureNeedsReview {
			pool = append(pool, track)
		}
	}
	if len(pool) < 3 {
		return nil, fmt.Errorf("not enough tracks remain after exclusions")
	}

	required := makeSet(req.RequiredTrackIDs)
	for id := range required {
		if !containsTrack(pool, id) {
			return nil, fmt.Errorf("required track %q is unavailable", id)
		}
	}

	seed := req.Seed
	if seed == 0 {
		seed = stableSeed(req)
	}
	usedEdges := map[string]int{}
	usedTracks := map[string]int{}
	sessionID := uuid.NewString()
	drafts := make([]domain.SetDraft, 0, req.VariationCount)
	for variation := 1; variation <= req.VariationCount; variation++ {
		draft, err := g.generateOne(pool, req, required, usedEdges, usedTracks, seed+int64(variation*7919), variation, sessionID)
		if err != nil {
			return nil, err
		}
		for i := 1; i < len(draft.Tracks); i++ {
			usedEdges[edgeKey(draft.Tracks[i-1].Track.ID, draft.Tracks[i].Track.ID)]++
		}
		for _, item := range draft.Tracks {
			usedTracks[item.Track.ID]++
		}
		drafts = append(drafts, draft)
	}
	return drafts, nil
}

func (g *Generator) generateOne(pool []domain.Track, req domain.GenerateRequest, required map[string]bool, usedEdges, usedTracks map[string]int, seed int64, variation int, sessionID string) (domain.SetDraft, error) {
	avgDuration := 0
	for _, track := range pool {
		avgDuration += track.DurationSeconds
	}
	avgDuration /= len(pool)
	targetSeconds := req.DurationMinutes * 60
	targetCount := max(3, int(math.Round(float64(targetSeconds)/float64(avgDuration))))
	targetCount = min(targetCount, len(pool))

	rng := rand.New(rand.NewPCG(uint64(seed), uint64(seed)^0x9e3779b97f4a7c15))
	states := openerStates(pool, req, usedTracks, rng)
	completed := make([]beamState, 0, beamWidth*4)
	maxPositions := min(len(pool), targetCount+5)
	for position := 1; position < maxPositions; position++ {
		next := make([]beamState, 0, beamWidth*branchWidth)
		progress := float64(position) / float64(max(1, targetCount-1))
		for _, state := range states {
			if len(state.tracks) >= 3 && state.duration >= int(float64(targetSeconds)*.94) {
				completed = append(completed, state)
			}
			if state.duration >= int(float64(targetSeconds)*1.03) && includesAll(state.used, required) {
				continue
			}
			candidates := g.rankCandidates(state, pool, req, required, usedEdges, usedTracks, progress, rng)
			for _, item := range candidates[:min(branchWidth, len(candidates))] {
				used := cloneSet(state.used)
				used[item.track.ID] = true
				next = append(next, beamState{
					tracks:      appendCopy(state.tracks, item.track),
					transitions: appendTransition(state.transitions, item.transition),
					used:        used,
					duration:    state.duration + item.track.DurationSeconds,
					score:       state.score + item.score,
				})
			}
		}
		if len(next) == 0 {
			break
		}
		sort.Slice(next, func(i, j int) bool {
			return normalizedStateScore(next[i], targetSeconds, position+1) > normalizedStateScore(next[j], targetSeconds, position+1)
		})
		states = next[:min(beamWidth, len(next))]
	}
	completed = append(completed, states...)

	valid := completed[:0]
	for _, state := range completed {
		if includesAll(state.used, required) {
			valid = append(valid, state)
		}
	}
	if len(valid) == 0 {
		return domain.SetDraft{}, fmt.Errorf("could not place all required tracks within the requested duration")
	}
	sort.Slice(valid, func(i, j int) bool {
		return finalStateScore(valid[i], targetSeconds, req) > finalStateScore(valid[j], targetSeconds, req)
	})
	return buildDraft(valid[0], req, variation, sessionID), nil
}

func openerStates(pool []domain.Track, req domain.GenerateRequest, usedTracks map[string]int, rng *rand.Rand) []beamState {
	target := targetEnergy(req.Arc, 0)
	candidates := make([]candidate, 0, len(pool))
	for _, track := range pool {
		score := .55 * clamp01(1-math.Abs(track.Energy-target)*1.45)
		if track.Role == "opener" {
			score += .18
		}
		if req.StartBPM > 0 {
			score += .68 * tempoTargetScore(track.BPM, req.StartBPM)
		}
		score -= float64(usedTracks[track.ID]) * (.1 + req.Exploration*.05)
		score += (rng.Float64() - .5) * req.Exploration * .12
		candidates = append(candidates, candidate{track: track, score: score})
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].score > candidates[j].score })
	states := make([]beamState, 0, min(18, len(candidates)))
	for _, item := range candidates[:min(18, len(candidates))] {
		states = append(states, beamState{
			tracks:   []domain.Track{item.track},
			used:     map[string]bool{item.track.ID: true},
			duration: item.track.DurationSeconds,
			score:    item.score,
		})
	}
	return states
}

func (g *Generator) rankCandidates(state beamState, pool []domain.Track, req domain.GenerateRequest, required map[string]bool, usedEdges, usedTracks map[string]int, progress float64, rng *rand.Rand) []candidate {
	from := state.tracks[len(state.tracks)-1]
	target := targetEnergy(req.Arc, progress)
	targetBPM := interpolatedBPM(req, progress)
	items := make([]candidate, 0, len(pool)-len(state.used))
	for _, track := range pool {
		if state.used[track.ID] {
			continue
		}
		transition := scoreTransition(from, track, req.HarmonicStrictness)
		energyFit := clamp01(1 - math.Abs(track.Energy-target)*1.45)
		bpmFit := .7
		if targetBPM > 0 {
			bpmFit = tempoTargetScore(track.BPM, targetBPM)
		}
		roleFit := roleScore(track.Role, progress)
		score := transition.Score*.45 + energyFit*.22 + bpmFit*.24 + roleFit*.09
		if required[track.ID] {
			score += .55
		}
		if recentArtist(state.tracks, track.Artist, 4) {
			score -= .24
		}
		score -= float64(usedEdges[edgeKey(from.ID, track.ID)]) * (.16 + req.Exploration*.08)
		score -= float64(usedTracks[track.ID]) * (.1 + req.Exploration*.05)
		score += (rng.Float64() - .5) * req.Exploration * .22
		items = append(items, candidate{track: track, transition: transition, score: score})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].score > items[j].score })
	return items
}

func scoreTransition(from, to domain.Track, strictness float64) domain.Transition {
	tempo := clamp01(math.Exp(-math.Abs(from.BPM-to.BPM) / 5.8))
	harmonic, harmonicNote := harmonicScore(from.Camelot, to.Camelot)
	groove := grooveScore(from.Groove, to.Groove)
	vocal := 1.0
	vocalNote := "vocal space is clear"
	if from.Vocal > .62 && to.Vocal > .62 {
		vocal = .18
		vocalNote = "both tracks carry dominant vocals"
	} else if from.Vocal > .72 && to.Vocal > .4 {
		vocal = .56
		vocalNote = "outgoing vocal needs a clean phrase exit"
	}
	energyStep := clamp01(1 - math.Max(0, math.Abs(to.Energy-from.Energy)-.18)*2.8)
	harmonicWeight := .14 + strictness*.24
	otherWeight := 1 - harmonicWeight
	score := harmonic*harmonicWeight + tempo*(otherWeight*.34) + groove*(otherWeight*.31) + vocal*(otherWeight*.19) + energyStep*(otherWeight*.16)
	score = clamp01(score)
	risk := "low"
	if score < .48 {
		risk = "high"
	} else if score < .68 {
		risk = "medium"
	}
	summary := transitionSummary(from, to, tempo, harmonic, groove, vocal)
	return domain.Transition{
		FromTrackID: from.ID,
		ToTrackID:   to.ID,
		Score:       round(score, 3),
		Risk:        risk,
		Summary:     summary,
		Components: []domain.ScoreComponent{
			{Name: "tempo", Score: round(tempo, 3), Note: fmt.Sprintf("%+.1f BPM movement", to.BPM-from.BPM)},
			{Name: "harmony", Score: round(harmonic, 3), Note: harmonicNote},
			{Name: "groove", Score: round(groove, 3), Note: from.Groove + " → " + to.Groove},
			{Name: "vocals", Score: round(vocal, 3), Note: vocalNote},
			{Name: "energy", Score: round(energyStep, 3), Note: fmt.Sprintf("%+.0f%% energy movement", (to.Energy-from.Energy)*100)},
		},
	}
}

func harmonicScore(from, to string) (float64, string) {
	fn, fl, fok := parseCamelot(from)
	tn, tl, tok := parseCamelot(to)
	if !fok || !tok {
		return .45, "key data is incomplete"
	}
	if fn == tn && fl == tl {
		return 1, "same Camelot key"
	}
	if fn == tn && fl != tl {
		return .92, "relative major/minor movement"
	}
	distance := circularDistance(fn, tn, 12)
	if fl == tl && distance == 1 {
		return .96, "adjacent Camelot movement"
	}
	if fl == tl && distance == 2 {
		return .68, "two-step Camelot movement"
	}
	if distance == 1 {
		return .62, "adjacent wheel position with mode change"
	}
	return .24, "non-adjacent harmonic movement; use a drum-led transition"
}

func grooveScore(from, to string) float64 {
	if from == to {
		return 1
	}
	pair := from + ":" + to
	reverse := to + ":" + from
	compatibility := map[string]float64{
		"afro:tribal": .96, "tribal:tech-house": .86, "house:tech-house": .9,
		"tech-house:techno": .91, "tribal:techno": .78, "afro:house": .76,
		"afro:tech-house": .72, "house:techno": .48, "afro:techno": .44,
	}
	if value, ok := compatibility[pair]; ok {
		return value
	}
	if value, ok := compatibility[reverse]; ok {
		return value
	}
	return .58
}

func targetEnergy(arc string, progress float64) float64 {
	progress = clamp01(progress)
	switch arc {
	case "roller":
		return .48 + .32*progress + .05*math.Sin(progress*math.Pi*4)
	case "peak":
		if progress < .82 {
			return .52 + .46*(progress/.82)
		}
		return .98 - .13*((progress-.82)/.18)
	case "sunset":
		if progress < .7 {
			return .25 + .48*(progress/.7)
		}
		return .73 - .18*((progress-.7)/.3)
	default:
		if progress < .72 {
			return .31 + .59*(progress/.72)
		}
		return .9 - .22*((progress-.72)/.28)
	}
}

func roleScore(role string, progress float64) float64 {
	switch role {
	case "opener":
		return clamp01(1 - progress*3)
	case "builder", "bridge":
		return clamp01(1 - math.Abs(progress-.4)*1.7)
	case "lifter", "peak":
		return clamp01(1 - math.Abs(progress-.78)*2)
	case "reset":
		return clamp01(1 - math.Abs(progress-.58)*2.5)
	case "closer":
		return clamp01(progress * 1.3)
	case "vocal":
		return .72
	default:
		return .6
	}
}

func buildDraft(state beamState, req domain.GenerateRequest, variation int, sessionID string) domain.SetDraft {
	tracks := make([]domain.SetTrack, len(state.tracks))
	energyFit := 0.0
	for i, track := range state.tracks {
		progress := float64(i) / float64(max(1, len(state.tracks)-1))
		target := targetEnergy(req.Arc, progress)
		energyFit += clamp01(1 - math.Abs(track.Energy-target)*1.45)
		item := domain.SetTrack{Position: i + 1, Track: track, TargetEnergy: round(target, 3)}
		if i > 0 {
			item.Transition = state.transitions[i-1]
		}
		tracks[i] = item
	}
	energyFit /= float64(len(tracks))
	transitionTempo, harmony := transitionAverages(state.transitions)
	tempo := transitionTempo*.7 + tempoCurveFit(state.tracks, req)*.3
	diversity := diversityScore(state.tracks)
	durationFit := clamp01(1 - math.Abs(float64(state.duration-req.DurationMinutes*60))/float64(req.DurationMinutes*60)*1.8)
	quality := 100 * (energyFit*.27 + tempo*.2 + harmony*.2 + diversity*.12 + durationFit*.16 + endingScore(state.tracks)*.05)
	return domain.SetDraft{
		ID:              uuid.NewString(),
		SessionID:       sessionID,
		Name:            fmt.Sprintf("%s — %c", req.Name, 'A'+rune(variation-1)),
		Variation:       variation,
		Arc:             req.Arc,
		DurationSeconds: state.duration,
		QualityScore:    round(quality, 1),
		EnergyFit:       round(energyFit*100, 1),
		HarmonicFlow:    round(harmony*100, 1),
		TempoFlow:       round(tempo*100, 1),
		Diversity:       round(diversity*100, 1),
		CreatedAt:       time.Now().UTC(),
		Tracks:          tracks,
	}
}

func transitionAverages(items []domain.Transition) (tempo, harmony float64) {
	if len(items) == 0 {
		return 1, 1
	}
	for _, item := range items {
		for _, component := range item.Components {
			switch component.Name {
			case "tempo":
				tempo += component.Score
			case "harmony":
				harmony += component.Score
			}
		}
	}
	return tempo / float64(len(items)), harmony / float64(len(items))
}

func diversityScore(tracks []domain.Track) float64 {
	grooves, sources, artists := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, track := range tracks {
		grooves[track.Groove], sources[track.SourcePlaylist], artists[track.Artist] = true, true, true
	}
	artistRatio := float64(len(artists)) / float64(len(tracks))
	return clamp01(float64(len(grooves))*.12 + float64(len(sources))*.08 + artistRatio*.55)
}

func endingScore(tracks []domain.Track) float64 {
	if len(tracks) == 0 {
		return 0
	}
	last := tracks[len(tracks)-1]
	if last.Role == "closer" {
		return 1
	}
	if last.Role == "peak" || last.Role == "lifter" {
		return .72
	}
	return .55
}

func transitionSummary(from, to domain.Track, tempo, harmonic, groove, vocal float64) string {
	parts := []string{}
	if tempo > .82 {
		parts = append(parts, "tempo locks cleanly")
	} else if tempo < .55 {
		parts = append(parts, "make the tempo change during a breakdown")
	}
	if harmonic > .88 {
		parts = append(parts, "harmonic movement is smooth")
	} else if harmonic < .45 {
		parts = append(parts, "lead with drums or an echo exit")
	}
	if groove > .84 {
		parts = append(parts, "the drum language carries the blend")
	}
	if vocal < .4 {
		parts = append(parts, "avoid overlapping the vocal phrases")
	}
	if len(parts) == 0 {
		parts = append(parts, "balanced transition with a standard phrase blend")
	}
	return strings.Join(parts, "; ")
}

func interpolatedBPM(req domain.GenerateRequest, progress float64) float64 {
	if req.StartBPM <= 0 && req.EndBPM <= 0 {
		return 0
	}
	start, end := req.StartBPM, req.EndBPM
	if start <= 0 {
		start = end
	}
	if end <= 0 {
		end = start
	}
	return start + (end-start)*clamp01(progress)
}

func tempoTargetScore(actual, target float64) float64 {
	return clamp01(math.Exp(-math.Abs(actual-target) / 5.5))
}

func finalStateScore(state beamState, targetSeconds int, req domain.GenerateRequest) float64 {
	base := normalizedStateScore(state, targetSeconds, len(state.tracks))
	base += .24 * tempoCurveFit(state.tracks, req)
	end := state.tracks[len(state.tracks)-1]
	if end.Role == "closer" {
		base += .12
	}
	if req.EndBPM > 0 {
		base += .18 * tempoTargetScore(end.BPM, req.EndBPM)
	}
	return base
}

func tempoCurveFit(tracks []domain.Track, req domain.GenerateRequest) float64 {
	if len(tracks) == 0 || (req.StartBPM <= 0 && req.EndBPM <= 0) {
		return 1
	}
	total := 0.0
	for index, track := range tracks {
		progress := float64(index) / float64(max(1, len(tracks)-1))
		total += tempoTargetScore(track.BPM, interpolatedBPM(req, progress))
	}
	return total / float64(len(tracks))
}

func normalizedStateScore(state beamState, targetSeconds, count int) float64 {
	durationFit := clamp01(1 - math.Abs(float64(state.duration-targetSeconds))/float64(targetSeconds))
	return state.score/float64(max(1, count)) + durationFit*.18
}

func stableSeed(req domain.GenerateRequest) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(fmt.Sprintf("%s|%d|%s|%.3f|%.3f|%.1f|%.1f", req.Name, req.DurationMinutes, req.Arc, req.HarmonicStrictness, req.Exploration, req.StartBPM, req.EndBPM)))
	return int64(h.Sum64())
}

func parseCamelot(value string) (int, byte, bool) {
	value = strings.TrimSpace(strings.ToUpper(value))
	if len(value) < 2 {
		return 0, 0, false
	}
	number, err := strconv.Atoi(value[:len(value)-1])
	letter := value[len(value)-1]
	if err != nil || number < 1 || number > 12 || (letter != 'A' && letter != 'B') {
		return 0, 0, false
	}
	return number, letter, true
}

func circularDistance(a, b, size int) int {
	d := abs(a - b)
	return min(d, size-d)
}

func edgeKey(from, to string) string { return from + ">" + to }

func recentArtist(tracks []domain.Track, artist string, window int) bool {
	start := max(0, len(tracks)-window)
	for _, track := range tracks[start:] {
		if track.Artist == artist {
			return true
		}
	}
	return false
}

func containsTrack(tracks []domain.Track, id string) bool {
	for _, track := range tracks {
		if track.ID == id {
			return true
		}
	}
	return false
}

func makeSet(values []string) map[string]bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	return set
}

func cloneSet(input map[string]bool) map[string]bool {
	copy := make(map[string]bool, len(input)+1)
	for key, value := range input {
		copy[key] = value
	}
	return copy
}

func includesAll(have, required map[string]bool) bool {
	for key := range required {
		if !have[key] {
			return false
		}
	}
	return true
}

func appendCopy[T any](values []T, value T) []T {
	result := make([]T, len(values)+1)
	copy(result, values)
	result[len(values)] = value
	return result
}

func appendTransition(values []domain.Transition, value domain.Transition) []domain.Transition {
	return appendCopy(values, value)
}

func clamp01(value float64) float64 { return math.Max(0, math.Min(1, value)) }
func round(value float64, places int) float64 {
	pow := math.Pow10(places)
	return math.Round(value*pow) / pow
}
func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}
