package tidal

import (
	"sort"
	"strings"
	"time"
)

type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	Scope        string    `json:"scope"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type Status struct {
	Configured    bool     `json:"configured"`
	Connected     bool     `json:"connected"`
	GrantedScopes []string `json:"grantedScopes"`
}

type Playlist struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	AccessType  string `json:"accessType"`
}

type CapabilityReport struct {
	Configured      bool     `json:"configured"`
	Connected       bool     `json:"connected"`
	GrantedScopes   []string `json:"grantedScopes"`
	CreatePlaylist  bool     `json:"createPlaylist"`
	ReadPlaylist    bool     `json:"readPlaylist"`
	AddPlaylistItem bool     `json:"addPlaylistItem"`
	DeletePlaylist  bool     `json:"deletePlaylist"`
	ProbePlaylistID string   `json:"probePlaylistId,omitempty"`
	Message         string   `json:"message"`
}

type resourceDocument struct {
	Data   resource   `json:"data"`
	Errors []apiError `json:"errors"`
}

type relationshipDocument struct {
	Data   []resourceIdentifier `json:"data"`
	Errors []apiError           `json:"errors"`
}

type resource struct {
	Type       string             `json:"type"`
	ID         string             `json:"id"`
	Attributes playlistAttributes `json:"attributes"`
}

type playlistAttributes struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	AccessType  string `json:"accessType"`
}

type resourceIdentifier struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type apiError struct {
	Status string `json:"status"`
	Code   string `json:"code"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

func (t Token) scopes() []string {
	if strings.TrimSpace(t.Scope) == "" {
		return []string{}
	}
	scopes := strings.Fields(t.Scope)
	sort.Strings(scopes)
	return scopes
}

func (r resource) playlist() Playlist {
	return Playlist{ID: r.ID, Name: r.Attributes.Name, Description: r.Attributes.Description, AccessType: r.Attributes.AccessType}
}
