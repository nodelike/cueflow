package main

import (
	"context"
	"fmt"
	"os"

	"cueflow/internal/config"
	"cueflow/internal/enrichmentcsv"
	"cueflow/internal/fixtures"
	"cueflow/internal/spotify"
	"cueflow/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	ctx := context.Background()
	cfg := config.Load()
	if os.Args[1] == "spotify-auth" {
		if err := spotifyAuth(ctx, cfg); err != nil {
			fatal(err)
		}
		return
	}
	repository, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer repository.Close()
	if err := repository.Migrate(ctx); err != nil {
		fatal(err)
	}
	switch os.Args[1] {
	case "migrate":
		fmt.Println("database migrated")
	case "seed":
		if err := repository.UpsertTracks(ctx, fixtures.Tracks()); err != nil {
			fatal(err)
		}
		fmt.Printf("seeded %d reference tracks\n", len(fixtures.Tracks()))
	case "spotify-sync":
		if err := spotifySync(ctx, cfg, repository); err != nil {
			fatal(err)
		}
	case "spotify-feature-check":
		if len(os.Args) != 3 {
			usage()
			os.Exit(2)
		}
		if err := spotifyFeatureCheck(ctx, cfg, os.Args[2]); err != nil {
			fatal(err)
		}
	case "enrich-import":
		if len(os.Args) != 3 {
			usage()
			os.Exit(2)
		}
		if err := enrichmentImport(ctx, repository, os.Args[2]); err != nil {
			fatal(err)
		}
	default:
		usage()
		os.Exit(2)
	}
}

func enrichmentImport(ctx context.Context, repository *store.Postgres, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open enrichment CSV: %w", err)
	}
	defer file.Close()
	rows, err := enrichmentcsv.Parse(file)
	if err != nil {
		return err
	}
	if err := repository.EnrichTracks(ctx, rows); err != nil {
		return fmt.Errorf("apply enrichment CSV: %w", err)
	}
	fmt.Printf("enriched %d tracks with provenance\n", len(rows))
	return nil
}

func spotifyFeatureCheck(ctx context.Context, cfg config.Config, trackID string) error {
	client := &spotify.Client{
		ClientID: cfg.SpotifyClientID,
		OAuth:    spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI},
		Store:    spotify.KeyringStore{},
	}
	features, err := client.TrackAudioFeatures(ctx, trackID)
	if err != nil {
		return err
	}
	fmt.Printf("track=%s tempo=%.3f key=%d mode=%d energy=%.3f danceability=%.3f instrumentalness=%.3f speechiness=%.3f valence=%.3f\n",
		features.ID, features.Tempo, features.Key, features.Mode, features.Energy, features.Danceability, features.Instrumentalness, features.Speechiness, features.Valence)
	return nil
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: cueflow migrate|seed|spotify-auth|spotify-sync|spotify-feature-check TRACK_ID|enrich-import FILE.csv")
}

func spotifyAuth(ctx context.Context, cfg config.Config) error {
	oauth := spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI}
	err := spotify.AuthorizeInteractive(ctx, oauth, spotify.KeyringStore{}, func(authorizationURL string) error {
		fmt.Println("Open this Spotify authorization URL:")
		fmt.Println(authorizationURL)
		return nil
	})
	if err == nil {
		fmt.Println("Spotify authorization stored securely in macOS Keychain")
	}
	return err
}

func spotifySync(ctx context.Context, cfg config.Config, repository *store.Postgres) error {
	oauth := spotify.OAuth{ClientID: cfg.SpotifyClientID, RedirectURI: cfg.SpotifyRedirectURI}
	client := &spotify.Client{ClientID: cfg.SpotifyClientID, OAuth: oauth, Store: spotify.KeyringStore{}}
	playlists := append(append([]spotify.Playlist{}, spotify.SourcePlaylists...), spotify.MasterPlaylist)
	total := 0
	for _, playlist := range playlists {
		items, err := client.PlaylistItems(ctx, playlist)
		if err != nil {
			return fmt.Errorf("sync %s: %w", playlist.Name, err)
		}
		if err := repository.SyncPlaylist(ctx, playlist, items); err != nil {
			return err
		}
		fmt.Printf("synced %-28s %3d tracks\n", playlist.Name, len(items))
		total += len(items)
	}
	fmt.Printf("Spotify sync complete: %d playlist entries\n", total)
	return nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
