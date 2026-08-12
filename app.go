package main

import (
	"context"
	"fmt"

	"cueflow/internal/config"
	"cueflow/internal/domain"
	"cueflow/internal/service"
	"cueflow/internal/spotify"
	"cueflow/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	service *service.Service
	store   *store.Postgres
	bootErr error
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	repository, err := store.Open(ctx, config.Load().DatabaseURL)
	if err != nil {
		a.bootErr = err
		return
	}
	if err := repository.Migrate(ctx); err != nil {
		repository.Close()
		a.bootErr = err
		return
	}
	a.store = repository
	cfg := config.Load()
	spotifyClient := &spotify.Client{ClientID: cfg.SpotifyClientID, OAuth: spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI}, Store: spotify.KeyringStore{}}
	a.service = service.New(repository).WithSpotify(spotifyClient)
}

func (a *App) shutdown(ctx context.Context) {
	if a.store != nil {
		a.store.Close()
	}
}

func (a *App) Bootstrap() domain.Bootstrap {
	if a.bootErr != nil {
		return domain.Bootstrap{Error: a.bootErr.Error()}
	}
	if a.service == nil {
		return domain.Bootstrap{Error: "Cueflow is not ready"}
	}
	return a.service.Bootstrap(a.ctx)
}

func (a *App) SeedReferenceCatalog() domain.Bootstrap {
	if a.bootErr != nil {
		return domain.Bootstrap{Error: a.bootErr.Error()}
	}
	if err := a.service.Seed(a.ctx); err != nil {
		return domain.Bootstrap{Error: err.Error()}
	}
	return a.service.Bootstrap(a.ctx)
}

func (a *App) GenerateSets(request domain.GenerateRequest) ([]domain.SetDraft, error) {
	if a.bootErr != nil {
		return nil, a.bootErr
	}
	if a.service == nil {
		return nil, fmt.Errorf("Cueflow is not ready")
	}
	return a.service.Generate(a.ctx, request)
}

func (a *App) SpotifyConnected() bool { return a.service != nil && a.service.SpotifyConnected() }

func (a *App) ConnectSpotify() error {
	if a.service == nil {
		return fmt.Errorf("Cueflow is not ready")
	}
	cfg := config.Load()
	oauth := spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI}
	return spotify.AuthorizeInteractive(a.ctx, oauth, spotify.KeyringStore{}, func(authorizationURL string) error {
		runtime.BrowserOpenURL(a.ctx, authorizationURL)
		return nil
	})
}

func (a *App) PublishSet(draftID string) (spotify.Playlist, error) {
	if a.service == nil {
		return spotify.Playlist{}, fmt.Errorf("Cueflow is not ready")
	}
	return a.service.Publish(a.ctx, draftID)
}

func (a *App) NeedsReview() ([]domain.Track, error) {
	if a.service == nil {
		return nil, fmt.Errorf("Cueflow is not ready")
	}
	return a.service.NeedsReview(a.ctx, 1000)
}

func (a *App) EnrichTrack(input domain.TrackEnrichment) error {
	if a.service == nil {
		return fmt.Errorf("Cueflow is not ready")
	}
	return a.service.EnrichTrack(a.ctx, input)
}
