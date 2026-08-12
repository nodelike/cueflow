package service

import (
	"context"
	"fmt"
	"strings"

	"cueflow/internal/domain"
	"cueflow/internal/fixtures"
	"cueflow/internal/generator"
	"cueflow/internal/spotify"
	"cueflow/internal/store"
)

type Service struct {
	store     *store.Postgres
	generator *generator.Generator
	spotify   *spotify.Client
}

func New(repository *store.Postgres) *Service {
	return &Service{store: repository, generator: generator.New()}
}

func (s *Service) WithSpotify(client *spotify.Client) *Service { s.spotify = client; return s }

func (s *Service) SpotifyConnected() bool { return s.spotify != nil && s.spotify.Connected() }

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
	trackCount, draftCount, err := s.store.Count(ctx)
	if err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	return domain.Bootstrap{
		DatabaseReady: true,
		TrackCount:    trackCount,
		DraftCount:    draftCount,
		Tracks:        tracks,
		Drafts:        drafts,
	}
}

func (s *Service) Seed(ctx context.Context) error {
	if err := s.store.Migrate(ctx); err != nil {
		return err
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
	drafts, err := s.generator.GenerateWithAnalyses(tracks, analyses, request)
	if err != nil {
		return nil, err
	}
	if err := s.store.SaveDrafts(ctx, drafts); err != nil {
		return nil, fmt.Errorf("save generated drafts: %w", err)
	}
	return drafts, nil
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
