package spotify

import (
	"strings"
	"time"

	"cueflow/internal/domain"
)

type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	Scope        string    `json:"scope"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type Playlist struct {
	ID       string
	Name     string
	Kind     string
	Writable bool
}

var SourcePlaylists = []Playlist{
	{ID: "5Qaffla02r1ZYK8Smd4kWu", Name: "House Vibezz", Kind: "source"},
	{ID: "1TLgLgjMRDg022DNLzHod0", Name: "Afro Vibezz", Kind: "source"},
	{ID: "1ap9KYrloP918ZzkYg6WK0", Name: "Tech House Vibezz", Kind: "source"},
	{ID: "6IdiiFE2wWoWCnKBcsg2Ct", Name: "Techno Vibezz", Kind: "source"},
}

var MasterPlaylist = Playlist{ID: "52LZgW4bWZqo4lmi9fSQX2", Name: "Techno, Afro, Soul & EDM", Kind: "master"}

type playlistPage struct {
	Items []playlistItem `json:"items"`
	Next  string         `json:"next"`
	Total int            `json:"total"`
}

type playlistItem struct {
	AddedAt time.Time    `json:"added_at"`
	Item    spotifyTrack `json:"item"`
}

type spotifyTrack struct {
	ID         string `json:"id"`
	URI        string `json:"uri"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	DurationMS int    `json:"duration_ms"`
	Artists    []struct {
		Name string `json:"name"`
	} `json:"artists"`
}

type SyncedTrack struct {
	Playlist Playlist
	Position int
	AddedAt  time.Time
	Track    spotifyTrack
}

type AudioFeatures struct {
	ID               string  `json:"id"`
	Tempo            float64 `json:"tempo"`
	Key              int     `json:"key"`
	Mode             int     `json:"mode"`
	Energy           float64 `json:"energy"`
	Danceability     float64 `json:"danceability"`
	Instrumentalness float64 `json:"instrumentalness"`
	Speechiness      float64 `json:"speechiness"`
	Valence          float64 `json:"valence"`
}

func (s SyncedTrack) DomainTrack() domain.Track {
	artists := make([]string, 0, len(s.Track.Artists))
	for _, artist := range s.Track.Artists {
		artists = append(artists, artist.Name)
	}
	return domain.Track{
		ID: "spotify-" + s.Track.ID, SpotifyID: s.Track.ID, SpotifyURI: s.Track.URI,
		Title: s.Track.Name, Artist: strings.Join(artists, ", "),
		DurationSeconds: max(1, s.Track.DurationMS/1000), SourcePlaylist: s.Playlist.Name,
		AddedAt: s.AddedAt, FeatureNeedsReview: true,
		FeatureProvenance: "Spotify identity; musical features pending research",
	}
}
