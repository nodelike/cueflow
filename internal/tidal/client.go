package tidal

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	previewPrefix = "Cueflow Preview — "
	setPrefix     = "Cueflow Set — "
	probePrefix   = "Cueflow Capability Check — "
)

type Client struct {
	ClientID   string
	APIBase    string
	OAuth      OAuth
	Store      TokenStore
	HTTPClient *http.Client
	mu         sync.Mutex
}

func (c *Client) Status() Status {
	status := Status{Configured: strings.TrimSpace(c.ClientID) != "", GrantedScopes: []string{}}
	if !status.Configured || c.Store == nil {
		return status
	}
	token, err := c.Store.Load()
	if err != nil || token.RefreshToken == "" {
		return status
	}
	status.Connected = true
	status.GrantedScopes = token.scopes()
	return status
}

func (c *Client) Connected() bool { return c.Status().Connected }

func (c *Client) CreatePlaylist(ctx context.Context, name, description string) (Playlist, error) {
	if !mutablePlaylistName(name) {
		return Playlist{}, fmt.Errorf("Cueflow may only create preview, saved-set, or capability-check playlists")
	}
	body := map[string]any{"data": map[string]any{
		"type":       "playlists",
		"attributes": map[string]any{"name": name, "description": description, "accessType": "UNLISTED"},
	}}
	var document resourceDocument
	if err := c.sendJSON(ctx, http.MethodPost, "/playlists", body, &document, true); err != nil {
		return Playlist{}, err
	}
	if document.Data.ID == "" {
		return Playlist{}, fmt.Errorf("TIDAL created a playlist without an ID")
	}
	return document.Data.playlist(), nil
}

// CreateSavedSet completes the create-and-fill operation before exposing a
// permanent playlist to callers. If filling fails, the uncommitted playlist is
// removed even though committed saved sets have no public deletion path.
func (c *Client) CreateSavedSet(ctx context.Context, name, description string, trackIDs []string) (Playlist, error) {
	if !strings.HasPrefix(name, setPrefix) {
		return Playlist{}, fmt.Errorf("permanent TIDAL set names must start with %q", setPrefix)
	}
	playlist, err := c.CreatePlaylist(ctx, name, description)
	if err != nil {
		return Playlist{}, err
	}
	if err := c.AddPlaylistItems(ctx, playlist.ID, trackIDs, ""); err != nil {
		cleanupErr := c.deletePlaylistWithPrefix(context.Background(), playlist.ID, setPrefix)
		if cleanupErr != nil {
			return Playlist{}, errors.Join(err, fmt.Errorf("clean up incomplete permanent playlist %s: %w", playlist.ID, cleanupErr))
		}
		return Playlist{}, err
	}
	return playlist, nil
}

func (c *Client) Playlist(ctx context.Context, playlistID string) (Playlist, error) {
	var document resourceDocument
	if err := c.sendJSON(ctx, http.MethodGet, "/playlists/"+url.PathEscape(playlistID), nil, &document, false); err != nil {
		return Playlist{}, err
	}
	return document.Data.playlist(), nil
}

func (c *Client) AddPlaylistItems(ctx context.Context, playlistID string, trackIDs []string, positionBefore string) error {
	playlist, err := c.Playlist(ctx, playlistID)
	if err != nil {
		return err
	}
	if !mutablePlaylistName(playlist.Name) {
		return fmt.Errorf("refusing to modify non-Cueflow TIDAL playlist %q", playlist.Name)
	}
	if len(trackIDs) == 0 {
		return fmt.Errorf("at least one TIDAL track ID is required")
	}
	for start := 0; start < len(trackIDs); start += 50 {
		end := min(start+50, len(trackIDs))
		items := make([]resourceIdentifier, 0, end-start)
		for _, trackID := range trackIDs[start:end] {
			if strings.TrimSpace(trackID) == "" {
				return fmt.Errorf("TIDAL track ID cannot be empty")
			}
			items = append(items, resourceIdentifier{Type: "tracks", ID: trackID})
		}
		body := map[string]any{"data": items}
		if strings.TrimSpace(positionBefore) != "" {
			body["meta"] = map[string]string{"positionBefore": positionBefore}
		}
		if err := c.sendJSON(ctx, http.MethodPost, "/playlists/"+url.PathEscape(playlistID)+"/relationships/items", body, nil, true); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) PlaylistItemIDs(ctx context.Context, playlistID string) ([]string, error) {
	var document relationshipDocument
	if err := c.sendJSON(ctx, http.MethodGet, "/playlists/"+url.PathEscape(playlistID)+"/relationships/items", nil, &document, false); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(document.Data))
	for _, item := range document.Data {
		if item.Type == "tracks" && item.ID != "" {
			ids = append(ids, item.ID)
		}
	}
	return ids, nil
}

// TrackIDsByISRC resolves exact recording identities without fuzzy title
// matching. TIDAL returns at most one track per ISRC when multiple ISRCs are
// requested, making the result safe for playlist publication.
func (c *Client) TrackIDsByISRC(ctx context.Context, isrcs []string) (map[string]TrackIdentity, error) {
	result := make(map[string]TrackIdentity, len(isrcs))
	for start := 0; start < len(isrcs); start += 20 {
		end := min(start+20, len(isrcs))
		query := url.Values{}
		for _, isrc := range isrcs[start:end] {
			isrc = strings.TrimSpace(isrc)
			if isrc == "" {
				return nil, fmt.Errorf("ISRC cannot be empty")
			}
			query.Add("filter[isrc]", isrc)
		}
		var document resourcesDocument
		if err := c.sendJSON(ctx, http.MethodGet, "/tracks?"+query.Encode(), nil, &document, false); err != nil {
			return nil, err
		}
		for _, track := range document.Data {
			if track.Type == "tracks" && track.ID != "" && track.Attributes.ISRC != "" {
				result[track.Attributes.ISRC] = TrackIdentity{ID: track.ID, ISRC: track.Attributes.ISRC, Title: track.Attributes.Title}
			}
		}
	}
	return result, nil
}

func (c *Client) DeletePlaylist(ctx context.Context, playlistID string) error {
	return c.deletePlaylistWithPrefix(ctx, playlistID, previewPrefix, probePrefix)
}

func (c *Client) deletePlaylistWithPrefix(ctx context.Context, playlistID string, prefixes ...string) error {
	playlist, err := c.Playlist(ctx, playlistID)
	if err != nil {
		return err
	}
	allowed := false
	for _, prefix := range prefixes {
		if strings.HasPrefix(playlist.Name, prefix) {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("refusing to delete non-Cueflow TIDAL playlist %q", playlist.Name)
	}
	return c.sendJSON(ctx, http.MethodDelete, "/playlists/"+url.PathEscape(playlistID), nil, nil, true)
}

func (c *Client) ProbeCapabilities(ctx context.Context, trackID string) (report CapabilityReport, err error) {
	status := c.Status()
	report = CapabilityReport{Configured: status.Configured, Connected: status.Connected, GrantedScopes: status.GrantedScopes}
	if !status.Configured {
		report.Message = "TIDAL client ID is not configured"
		return report, errors.New(report.Message)
	}
	if !status.Connected {
		report.Message = "TIDAL is not connected"
		return report, errors.New(report.Message)
	}
	name := probePrefix + time.Now().UTC().Format("20060102-150405")
	created, err := c.CreatePlaylist(ctx, name, "Temporary Cueflow capability probe. This playlist is deleted automatically.")
	if err != nil {
		report.Message = "TIDAL rejected playlist creation"
		return report, err
	}
	report.CreatePlaylist = true
	report.ProbePlaylistID = created.ID
	deleted := false
	defer func() {
		if deleted {
			return
		}
		cleanupErr := c.DeletePlaylist(context.Background(), created.ID)
		if cleanupErr == nil {
			report.DeletePlaylist = true
			return
		}
		if err == nil {
			err = fmt.Errorf("clean up TIDAL capability playlist %s: %w", created.ID, cleanupErr)
		}
	}()

	readBack, err := c.Playlist(ctx, created.ID)
	if err != nil || readBack.ID != created.ID {
		report.Message = "Playlist was created but could not be read back"
		if err == nil {
			err = fmt.Errorf("TIDAL returned an unexpected playlist ID")
		}
		return report, err
	}
	report.ReadPlaylist = true
	if strings.TrimSpace(trackID) != "" {
		if err := c.AddPlaylistItems(ctx, created.ID, []string{trackID}, ""); err != nil {
			report.Message = "Playlist create/read worked, but adding an item failed"
			return report, err
		}
		items, readErr := c.PlaylistItemIDs(ctx, created.ID)
		if readErr != nil {
			report.Message = "Item add returned success, but the playlist items could not be read"
			return report, readErr
		}
		for _, id := range items {
			if id == trackID {
				report.AddPlaylistItem = true
				break
			}
		}
		if !report.AddPlaylistItem {
			report.Message = "TIDAL did not expose the added item after the write"
			return report, errors.New(report.Message)
		}
	}
	if err := c.DeletePlaylist(ctx, created.ID); err != nil {
		report.Message = "Playlist create/read worked, but deletion failed"
		return report, err
	}
	deleted = true
	report.DeletePlaylist = true
	report.ProbePlaylistID = ""
	if report.AddPlaylistItem {
		report.Message = "TIDAL playlist create, add, read, and delete are available"
	} else {
		report.Message = "TIDAL playlist create, read, and delete are available; item add was not tested"
	}
	return report, nil
}

func (c *Client) sendJSON(ctx context.Context, method, path string, body any, target any, idempotent bool) error {
	token, err := c.accessToken(ctx)
	if err != nil {
		return err
	}
	var payload io.Reader
	if body != nil {
		encoded, marshalErr := json.Marshal(body)
		if marshalErr != nil {
			return marshalErr
		}
		payload = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.apiBase(), "/")+path, payload)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Accept", "application/vnd.api+json")
	if body != nil {
		request.Header.Set("Content-Type", "application/vnd.api+json")
	}
	if idempotent {
		key, keyErr := idempotencyKey()
		if keyErr != nil {
			return keyErr
		}
		request.Header.Set("Idempotency-Key", key)
	}
	response, err := c.client().Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		var document struct {
			Errors []apiError `json:"errors"`
		}
		_ = json.NewDecoder(response.Body).Decode(&document)
		detail := ""
		if len(document.Errors) > 0 {
			detail = firstNonEmpty(document.Errors[0].Detail, document.Errors[0].Title, document.Errors[0].Code)
		}
		if detail != "" {
			return fmt.Errorf("TIDAL API %s %s failed (%d): %s", method, path, response.StatusCode, detail)
		}
		return fmt.Errorf("TIDAL API %s %s failed (%d)", method, path, response.StatusCode)
	}
	if target == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		return fmt.Errorf("decode TIDAL API response: %w", err)
	}
	return nil
}

func (c *Client) accessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.Store == nil {
		return "", fmt.Errorf("TIDAL token store is not configured")
	}
	token, err := c.Store.Load()
	if err != nil {
		return "", fmt.Errorf("TIDAL is not connected: %w", err)
	}
	if token.AccessToken != "" && time.Now().Before(token.ExpiresAt) {
		return token.AccessToken, nil
	}
	refreshed, err := c.OAuth.Refresh(ctx, token.RefreshToken)
	if err != nil {
		return "", err
	}
	if err := c.Store.Save(refreshed); err != nil {
		return "", err
	}
	return refreshed.AccessToken, nil
}

func (c *Client) apiBase() string {
	if c.APIBase != "" {
		return c.APIBase
	}
	return "https://openapi.tidal.com/v2"
}

func (c *Client) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 20 * time.Second}
}

func mutablePlaylistName(name string) bool {
	return strings.HasPrefix(name, previewPrefix) || strings.HasPrefix(name, setPrefix) || strings.HasPrefix(name, probePrefix)
}

func idempotencyKey() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
