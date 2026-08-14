package spotify

import (
	"strings"
	"time"

	"github.com/nodelike/cueflow/internal/domain"
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
	ID         string
	Name       string
	Kind       string
	Writable   bool
	ImageURL   string
	TrackCount int
	Synced     bool
}

type image struct {
	URL string `json:"url"`
}

type userPlaylistsPage struct {
	Items []simplifiedPlaylist `json:"items"`
	Next  string               `json:"next"`
	Total int                  `json:"total"`
}

type simplifiedPlaylist struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Images []image `json:"images"`
	Items  struct {
		Total int `json:"total"`
	} `json:"items"`
	Tracks struct {
		Total int `json:"total"`
	} `json:"tracks"`
}

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
	Album struct {
		Images []image `json:"images"`
	} `json:"album"`
	ExternalIDs struct {
		ISRC string `json:"isrc"`
	} `json:"external_ids"`
}

type tracksResponse struct {
	Tracks []spotifyTrack `json:"tracks"`
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
	imageURL := ""
	if len(s.Track.Album.Images) > 0 {
		imageURL = s.Track.Album.Images[len(s.Track.Album.Images)-1].URL
	}
	return domain.Track{
		ID: "spotify-" + s.Track.ID, SpotifyID: s.Track.ID, SpotifyURI: s.Track.URI,
		Title: s.Track.Name, Artist: strings.Join(artists, ", "), AlbumImageURL: imageURL,
		DurationSeconds: max(1, s.Track.DurationMS/1000), SourcePlaylist: s.Playlist.Name,
		AddedAt: s.AddedAt, FeatureNeedsReview: true,
		FeatureProvenance: "Spotify identity; musical features pending research",
	}
}
