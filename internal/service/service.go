package service

import (
	"context"
	"fmt"

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
	tracks, err := s.store.ListTracks(ctx)
	if err != nil {
		return nil, err
	}
	drafts, err := s.generator.Generate(tracks, request)
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
