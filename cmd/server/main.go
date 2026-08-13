package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cueflow/internal/config"
	"cueflow/internal/httpapi"
	"cueflow/internal/service"
	"cueflow/internal/spotify"
	"cueflow/internal/store"
	"cueflow/internal/tidal"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := config.Load()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	repository, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("postgres unavailable", "error", err)
		os.Exit(1)
	}
	defer repository.Close()
	if err := repository.Migrate(ctx); err != nil {
		logger.Error("migration failed", "error", err)
		os.Exit(1)
	}

	spotifyClient := &spotify.Client{ClientID: cfg.SpotifyClientID, OAuth: spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI}, Store: spotify.KeyringStore{}}
	tidalOAuth := tidal.OAuth{ClientID: cfg.TidalClientID, RedirectURI: cfg.TidalRedirectURI}
	tidalClient := &tidal.Client{ClientID: cfg.TidalClientID, OAuth: tidalOAuth, Store: tidal.KeyringStore{}}
	httpServer := &http.Server{
		Addr:              cfg.APIAddr,
		Handler:           httpapi.New(service.New(repository).WithSpotify(spotifyClient).WithTidal(tidalClient), logger),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		logger.Info("cueflow api listening", "address", "http://"+cfg.APIAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("api stopped", "error", err)
			cancel()
		}
	}()
	<-ctx.Done()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = httpServer.Shutdown(shutdownCtx)
}
