package config

import "os"

type Config struct {
	DatabaseURL        string
	APIAddr            string
	SpotifyClientID    string
	SpotifyRedirectURI string
}

func Load() Config {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		user := os.Getenv("USER")
		if user == "" {
			user = "postgres"
		}
		databaseURL = "postgres://" + user + "@127.0.0.1:5432/cueflow?sslmode=disable"
	}
	addr := os.Getenv("CUEFLOW_API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	clientID := os.Getenv("CUEFLOW_SPOTIFY_CLIENT_ID")
	if clientID == "" {
		clientID = "bc869f7045ff48eba5c9689e1bd33119"
	}
	redirectURI := os.Getenv("CUEFLOW_SPOTIFY_REDIRECT_URI")
	if redirectURI == "" {
		redirectURI = "http://127.0.0.1:3000/api/spotify/callback"
	}
	return Config{DatabaseURL: databaseURL, APIAddr: addr, SpotifyClientID: clientID, SpotifyRedirectURI: redirectURI}
}
