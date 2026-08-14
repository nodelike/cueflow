package spotify

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type OAuth struct {
	ClientID     string
	RedirectURI  string
	AccountsBase string
	HTTPClient   *http.Client
}

type Authorization struct {
	URL      string
	State    string
	Verifier string
}

func (o OAuth) Begin() (Authorization, error) {
	if strings.TrimSpace(o.ClientID) == "" {
		return Authorization{}, fmt.Errorf("Spotify client ID is not configured")
	}
	if _, err := url.ParseRequestURI(o.RedirectURI); err != nil {
		return Authorization{}, fmt.Errorf("invalid Spotify redirect URI: %w", err)
	}
	verifier, err := randomURLSafe(64)
	if err != nil {
		return Authorization{}, err
	}
	state, err := randomURLSafe(24)
	if err != nil {
		return Authorization{}, err
	}
	challenge := sha256.Sum256([]byte(verifier))
	values := url.Values{
		"client_id":             {o.ClientID},
		"response_type":         {"code"},
		"redirect_uri":          {o.RedirectURI},
		"scope":                 {"playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private"},
		"code_challenge_method": {"S256"},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
		"state":                 {state},
	}
	return Authorization{URL: strings.TrimRight(o.accountsBase(), "/") + "/authorize?" + values.Encode(), State: state, Verifier: verifier}, nil
}

func (o OAuth) Exchange(ctx context.Context, code, verifier string) (Token, error) {
	values := url.Values{
		"client_id":     {o.ClientID},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {o.RedirectURI},
		"code_verifier": {verifier},
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(o.accountsBase(), "/")+"/api/token", strings.NewReader(values.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := o.client().Do(request)
	if err != nil {
		return Token{}, err
	}
	defer response.Body.Close()
	var token Token
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return Token{}, fmt.Errorf("decode Spotify token: %w", err)
	}
	if response.StatusCode/100 != 2 || token.AccessToken == "" {
		return Token{}, fmt.Errorf("Spotify token exchange failed (%d)", response.StatusCode)
	}
	token.ExpiresAt = time.Now().Add(time.Duration(token.ExpiresIn-30) * time.Second)
	return token, nil
}

func (o OAuth) Refresh(ctx context.Context, refreshToken string) (Token, error) {
	values := url.Values{"client_id": {o.ClientID}, "grant_type": {"refresh_token"}, "refresh_token": {refreshToken}}
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(o.accountsBase(), "/")+"/api/token", strings.NewReader(values.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := o.client().Do(request)
	if err != nil {
		return Token{}, err
	}
	defer response.Body.Close()
	var token Token
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return Token{}, err
	}
	if response.StatusCode/100 != 2 || token.AccessToken == "" {
		return Token{}, fmt.Errorf("Spotify token refresh failed (%d)", response.StatusCode)
	}
	if token.RefreshToken == "" {
		token.RefreshToken = refreshToken
	}
	token.ExpiresAt = time.Now().Add(time.Duration(token.ExpiresIn-30) * time.Second)
	return token, nil
}

func (o OAuth) accountsBase() string {
	if o.AccountsBase != "" {
		return o.AccountsBase
	}
	return "https://accounts.spotify.com"
}
func (o OAuth) client() *http.Client {
	if o.HTTPClient != nil {
		return o.HTTPClient
	}
	return &http.Client{Timeout: 20 * time.Second}
}
func randomURLSafe(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
