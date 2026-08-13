package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"cueflow/internal/domain"
	"cueflow/internal/fixtures"
	"cueflow/internal/generator"
	"cueflow/internal/spotify"
	"cueflow/internal/store"
	"cueflow/internal/tidal"
)

type Service struct {
	store      *store.Postgres
	generator  *generator.Generator
	spotify    *spotify.Client
	tidal      *tidal.Client
	tidalSetMu sync.Mutex
}

func New(repository *store.Postgres) *Service {
	return &Service{store: repository, generator: generator.New()}
}

func (s *Service) WithSpotify(client *spotify.Client) *Service { s.spotify = client; return s }

func (s *Service) WithTidal(client *tidal.Client) *Service { s.tidal = client; return s }

func (s *Service) SpotifyConnected() bool { return s.spotify != nil && s.spotify.Connected() }

func (s *Service) TidalStatus() tidal.Status {
	if s.tidal == nil {
		return tidal.Status{GrantedScopes: []string{}}
	}
	return s.tidal.Status()
}

func (s *Service) ProbeTidalCapabilities(ctx context.Context, trackID string) (tidal.CapabilityReport, error) {
	if s.tidal == nil {
		return tidal.CapabilityReport{}, fmt.Errorf("TIDAL is not configured")
	}
	return s.tidal.ProbeCapabilities(ctx, trackID)
}

// PublishTidalPreviews publishes a whole generated session so its variations
// can be compared in djay Pro. Exact ISRC matching prevents a similarly named
// remix or re-recording from being substituted silently.
func (s *Service) PublishTidalPreviews(ctx context.Context, draftIDs []string) (tidal.PreviewBatch, error) {
	result := tidal.PreviewBatch{Playlists: []tidal.PreviewPlaylist{}, Warnings: []string{}}
	if len(draftIDs) == 0 {
		return result, fmt.Errorf("select at least one generated variation")
	}
	drafts, tidalIDBySpotifyID, matchedTracks, err := s.resolveTidalDrafts(ctx, draftIDs, true)
	if err != nil {
		return result, err
	}
	result.MatchedTracks = matchedTracks

	created := []tidal.PreviewPlaylist{}
	cleanupCreated := func() {
		for _, preview := range created {
			_ = s.tidal.DeletePlaylist(context.Background(), preview.PlaylistID)
		}
	}
	for _, draft := range drafts {
		name := "Cueflow Preview — " + draft.Name
		playlist, err := s.tidal.CreatePlaylist(ctx, name, "Disposable Cueflow variation for testing in djay Pro. Replaced on the next preview publish.")
		if err != nil {
			cleanupCreated()
			return result, fmt.Errorf("create TIDAL preview for %s: %w", draft.Name, err)
		}
		preview := tidal.PreviewPlaylist{PlaylistID: playlist.ID, DraftID: draft.ID, SessionID: draft.SessionID, Variation: draft.Variation, Name: playlist.Name, CreatedAt: time.Now().UTC()}
		created = append(created, preview)
		trackIDs := tidalTrackIDs(draft, tidalIDBySpotifyID)
		if err := s.tidal.AddPlaylistItems(ctx, playlist.ID, trackIDs, ""); err != nil {
			cleanupCreated()
			return result, fmt.Errorf("fill TIDAL preview for %s: %w", draft.Name, err)
		}
	}

	previous, err := s.store.TidalPreviews(ctx)
	if err != nil {
		cleanupCreated()
		return result, err
	}
	tracked := append(append([]tidal.PreviewPlaylist{}, previous...), created...)
	if err := s.store.ReplaceTidalPreviews(ctx, tracked); err != nil {
		cleanupCreated()
		return result, err
	}
	failedPrevious := []tidal.PreviewPlaylist{}
	for _, preview := range previous {
		if err := s.tidal.DeletePlaylist(ctx, preview.PlaylistID); err != nil {
			failedPrevious = append(failedPrevious, preview)
			result.Warnings = append(result.Warnings, fmt.Sprintf("could not remove previous preview %s: %v", preview.Name, err))
			continue
		}
		result.DeletedPrevious++
	}
	if err := s.store.ReplaceTidalPreviews(ctx, append(failedPrevious, created...)); err != nil {
		return result, err
	}
	result.Playlists = created
	return result, nil
}

// SaveTidalSet promotes exactly one generated variation into a permanent,
// unlisted TIDAL playlist. It is idempotent per draft and never enters the
// disposable preview registry.
func (s *Service) SaveTidalSet(ctx context.Context, draftID string) (tidal.SavedSet, error) {
	s.tidalSetMu.Lock()
	defer s.tidalSetMu.Unlock()

	if strings.TrimSpace(draftID) == "" {
		return tidal.SavedSet{}, fmt.Errorf("select a variation to save")
	}
	if existing, ok, err := s.store.TidalSavedSetForDraft(ctx, draftID); err != nil {
		return tidal.SavedSet{}, err
	} else if ok {
		return existing, nil
	}
	drafts, tidalIDBySpotifyID, _, err := s.resolveTidalDrafts(ctx, []string{draftID}, false)
	if err != nil {
		return tidal.SavedSet{}, err
	}
	draft := drafts[0]
	playlist, err := s.tidal.CreateSavedSet(
		ctx,
		"Cueflow Set — "+draft.Name,
		"Permanent Cueflow set for djay Pro. Never removed by preview cleanup.",
		tidalTrackIDs(draft, tidalIDBySpotifyID),
	)
	if err != nil {
		return tidal.SavedSet{}, fmt.Errorf("create permanent TIDAL set for %s: %w", draft.Name, err)
	}
	set := tidal.SavedSet{
		PlaylistID: playlist.ID, DraftID: draft.ID, SessionID: draft.SessionID,
		Variation: draft.Variation, Name: playlist.Name, TrackCount: len(draft.Tracks), CreatedAt: time.Now().UTC(),
	}
	if err := s.store.SaveTidalSet(ctx, set); err != nil {
		return tidal.SavedSet{}, fmt.Errorf("TIDAL set %s was created but its permanent record could not be saved: %w", playlist.ID, err)
	}
	return set, nil
}

func (s *Service) TidalSavedSets(ctx context.Context) ([]tidal.SavedSet, error) {
	return s.store.TidalSavedSets(ctx)
}

func (s *Service) resolveTidalDrafts(ctx context.Context, draftIDs []string, requireSameSession bool) ([]domain.SetDraft, map[string]string, int, error) {
	if s.spotify == nil || !s.spotify.Connected() {
		return nil, nil, 0, fmt.Errorf("Spotify is not connected; Cueflow needs Spotify recording IDs to resolve exact TIDAL tracks")
	}
	if s.tidal == nil || !s.tidal.Connected() {
		return nil, nil, 0, fmt.Errorf("TIDAL is not connected")
	}

	drafts := make([]domain.SetDraft, 0, len(draftIDs))
	spotifyIDs := []string{}
	trackBySpotifyID := map[string]domain.Track{}
	seenSpotifyID := map[string]bool{}
	seenDraftID := map[string]bool{}
	sessionID := ""
	for _, draftID := range draftIDs {
		if seenDraftID[draftID] {
			return nil, nil, 0, fmt.Errorf("variation %q was selected more than once", draftID)
		}
		seenDraftID[draftID] = true
		draft, err := s.store.GetDraft(ctx, draftID)
		if err != nil {
			return nil, nil, 0, err
		}
		if sessionID == "" {
			sessionID = draft.SessionID
		} else if requireSameSession && draft.SessionID != sessionID {
			return nil, nil, 0, fmt.Errorf("TIDAL previews must come from one generation session")
		}
		drafts = append(drafts, draft)
		for _, item := range draft.Tracks {
			id := strings.TrimSpace(item.Track.SpotifyID)
			if id == "" {
				return nil, nil, 0, fmt.Errorf("%s has no Spotify recording identity", item.Track.Title)
			}
			trackBySpotifyID[id] = item.Track
			if !seenSpotifyID[id] {
				spotifyIDs = append(spotifyIDs, id)
				seenSpotifyID[id] = true
			}
		}
	}

	isrcBySpotifyID, err := s.spotify.TrackISRCs(ctx, spotifyIDs)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("resolve Spotify recording identities: %w", err)
	}
	isrcs := make([]string, 0, len(spotifyIDs))
	missing := []string{}
	for _, spotifyID := range spotifyIDs {
		isrc := isrcBySpotifyID[spotifyID]
		if isrc == "" {
			missing = append(missing, trackBySpotifyID[spotifyID].Title)
			continue
		}
		isrcs = append(isrcs, isrc)
	}
	if len(missing) > 0 {
		return nil, nil, 0, fmt.Errorf("Spotify did not provide ISRCs for: %s", strings.Join(missing, ", "))
	}
	tidalByISRC, err := s.tidal.TrackIDsByISRC(ctx, isrcs)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("resolve tracks in TIDAL: %w", err)
	}
	tidalIDBySpotifyID := make(map[string]string, len(spotifyIDs))
	for _, spotifyID := range spotifyIDs {
		isrc := isrcBySpotifyID[spotifyID]
		identity, ok := tidalByISRC[isrc]
		if !ok {
			missing = append(missing, trackBySpotifyID[spotifyID].Title+" — "+trackBySpotifyID[spotifyID].Artist)
			continue
		}
		tidalIDBySpotifyID[spotifyID] = identity.ID
	}
	if len(missing) > 0 {
		return nil, nil, 0, fmt.Errorf("not available as exact recordings on TIDAL: %s", strings.Join(missing, "; "))
	}
	return drafts, tidalIDBySpotifyID, len(tidalIDBySpotifyID), nil
}

func tidalTrackIDs(draft domain.SetDraft, bySpotifyID map[string]string) []string {
	trackIDs := make([]string, 0, len(draft.Tracks))
	for _, item := range draft.Tracks {
		trackIDs = append(trackIDs, bySpotifyID[item.Track.SpotifyID])
	}
	return trackIDs
}

func (s *Service) SpotifyPlaylists(ctx context.Context) ([]spotify.Playlist, error) {
	if s.spotify == nil || !s.spotify.Connected() {
		return nil, fmt.Errorf("Spotify is not connected")
	}
	playlists, err := s.spotify.CurrentUserPlaylists(ctx)
	if err != nil {
		return nil, err
	}
	synced, err := s.store.SyncedPlaylists(ctx)
	if err != nil {
		return nil, err
	}
	for index := range playlists {
		if stored, ok := synced[playlists[index].ID]; ok {
			playlists[index].Synced = true
			playlists[index].Kind = stored.Kind
		}
	}
	return playlists, nil
}

func (s *Service) SyncSpotifyPlaylists(ctx context.Context, playlistIDs []string) error {
	if s.spotify == nil || !s.spotify.Connected() {
		return fmt.Errorf("Spotify is not connected")
	}
	if len(playlistIDs) == 0 {
		return fmt.Errorf("select at least one Spotify playlist")
	}
	available, err := s.spotify.CurrentUserPlaylists(ctx)
	if err != nil {
		return err
	}
	byID := make(map[string]spotify.Playlist, len(available))
	for _, playlist := range available {
		byID[playlist.ID] = playlist
	}
	seen := map[string]bool{}
	for _, id := range playlistIDs {
		if seen[id] {
			continue
		}
		playlist, ok := byID[id]
		if !ok {
			return fmt.Errorf("Spotify playlist %q is unavailable", id)
		}
		items, err := s.spotify.PlaylistItems(ctx, playlist)
		if err != nil {
			return fmt.Errorf("sync %s: %w", playlist.Name, err)
		}
		if err := s.store.SyncPlaylist(ctx, playlist, items); err != nil {
			return err
		}
		seen[id] = true
	}
	return nil
}

func (s *Service) Publish(ctx context.Context, draftID string) (spotify.Playlist, error) {
	if s.spotify == nil {
		return spotify.Playlist{}, fmt.Errorf("Spotify is not connected")
	}
	draft, err := s.store.GetDraft(ctx, draftID)
	if err != nil {
		return spotify.Playlist{}, err
	}
	uris := make([]string, 0, len(draft.Tracks))
	for _, item := range draft.Tracks {
		if item.Track.SpotifyURI == "" {
			return spotify.Playlist{}, fmt.Errorf("%s has no Spotify identity", item.Track.Title)
		}
		uris = append(uris, item.Track.SpotifyURI)
	}
	return s.spotify.PublishSet(ctx, "Set Lab — "+draft.Name, uris)
}

func (s *Service) Bootstrap(ctx context.Context) domain.Bootstrap {
	tracks, err := s.store.ListTracks(ctx)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	drafts, err := s.store.ListDrafts(ctx, 18)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	transitionFeedback, err := s.store.ListTransitionFeedback(ctx)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	syncedPlaylists, err := s.store.ListSyncedPlaylists(ctx)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	catalog := make(map[string]domain.Track, len(tracks))
	for _, track := range tracks {
		catalog[track.ID] = track
	}
	for draftIndex := range drafts {
		for trackIndex := range drafts[draftIndex].Tracks {
			if current, ok := catalog[drafts[draftIndex].Tracks[trackIndex].Track.ID]; ok {
				drafts[draftIndex].Tracks[trackIndex].Track.AlbumImageURL = current.AlbumImageURL
				drafts[draftIndex].Tracks[trackIndex].Track.SourcePlaylistIDs = current.SourcePlaylistIDs
			}
		}
	}
	_, draftCount, err := s.store.Count(ctx)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	return domain.Bootstrap{
		DatabaseReady:      true,
		TrackCount:         len(tracks),
		DraftCount:         draftCount,
		Tracks:             tracks,
		Drafts:             drafts,
		SyncedPlaylists:    syncedPlaylists,
		TransitionFeedback: transitionFeedback,
	}
}

func (s *Service) Seed(ctx context.Context) error {
	if err := s.store.Migrate(ctx); err != nil {
		return err
	}
	synced, err := s.store.SyncedPlaylists(ctx)
	if err != nil {
		return err
	}
	if len(synced) > 0 {
		return fmt.Errorf("reference fixtures cannot be added after Spotify playlists are synced")
	}
	return s.store.UpsertTracks(ctx, fixtures.Tracks())
}

func (s *Service) Generate(ctx context.Context, request domain.GenerateRequest) ([]domain.SetDraft, error) {
	tracks, err := s.store.ListTracksForPlaylists(ctx, request.SourcePlaylistIDs, request.RequiredTrackIDs)
	if err != nil {
		return nil, err
	}
	trackIDs := make([]string, len(tracks))
	for index, track := range tracks {
		trackIDs[index] = track.ID
	}
	analyses, err := s.store.LatestTrackAnalyses(ctx, trackIDs)
	if err != nil {
		return nil, err
	}
	transitionFeedback, err := s.store.ListTransitionFeedback(ctx)
	if err != nil {
		return nil, err
	}
	drafts, err := s.generator.GenerateWithAnalysesAndFeedback(tracks, analyses, transitionFeedback, request)
	if err != nil {
		return nil, err
	}
	if err := s.store.SaveDrafts(ctx, drafts); err != nil {
		return nil, fmt.Errorf("save generated drafts: %w", err)
	}
	return drafts, nil
}

func (s *Service) SaveTransitionFeedback(ctx context.Context, feedback domain.TransitionFeedback) (domain.TransitionFeedback, error) {
	return s.store.SaveTransitionFeedback(ctx, feedback)
}

func (s *Service) EnrichTrack(ctx context.Context, input domain.TrackEnrichment) error {
	return s.store.EnrichTrack(ctx, input)
}

func (s *Service) NeedsReview(ctx context.Context, limit int) ([]domain.Track, error) {
	return s.store.ListNeedsReview(ctx, limit)
}

func (s *Service) TrackWaveform(ctx context.Context, trackID string) (domain.TrackWaveform, error) {
	trackID = strings.TrimSpace(trackID)
	if trackID == "" {
		return domain.TrackWaveform{}, fmt.Errorf("track ID is required")
	}
	analyses, err := s.store.LatestTrackAnalyses(ctx, []string{trackID})
	if err != nil {
		return domain.TrackWaveform{}, err
	}
	overview := domain.TrackWaveform{TrackID: trackID, Waveform: []domain.WaveformPoint{}}
	if analysis, ok := analyses[trackID]; ok {
		overview.DurationSeconds = analysis.DurationSeconds
		overview.AnalyzerVersion = analysis.AnalyzerVersion
		overview.Waveform = analysis.Waveform
	}
	return overview, nil
}
