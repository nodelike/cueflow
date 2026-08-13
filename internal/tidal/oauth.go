package tidal

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

// Request only the narrow public scope needed for Cueflow's disposable output
// playlists. TIDAL rejects authorization when an app asks for scopes that have
// not been enabled for that developer application.
const defaultScopes = "playlists.write"

type OAuth struct {
	ClientID    string
	RedirectURI string
	Scopes      string
	LoginBase   string
	TokenBase   string
	HTTPClient  *http.Client
}

type Authorization struct {
	URL      string
	State    string
	Verifier string
}

func (o OAuth) Begin() (Authorization, error) {
	if strings.TrimSpace(o.ClientID) == "" {
		return Authorization{}, fmt.Errorf("TIDAL client ID is not configured")
	}
	if _, err := url.ParseRequestURI(o.RedirectURI); err != nil {
		return Authorization{}, fmt.Errorf("invalid TIDAL redirect URI: %w", err)
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
		"scope":                 {o.scopes()},
		"code_challenge_method": {"S256"},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(challenge[:])},
		"state":                 {state},
	}
	return Authorization{URL: strings.TrimRight(o.loginBase(), "/") + "/authorize?" + values.Encode(), State: state, Verifier: verifier}, nil
}

func (o OAuth) Exchange(ctx context.Context, code, verifier string) (Token, error) {
	return o.requestToken(ctx, url.Values{
		"client_id":     {o.ClientID},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {o.RedirectURI},
		"code_verifier": {verifier},
	})
}

func (o OAuth) Refresh(ctx context.Context, refreshToken string) (Token, error) {
	token, err := o.requestToken(ctx, url.Values{
		"client_id":     {o.ClientID},
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"scope":         {o.scopes()},
	})
	if err == nil && token.RefreshToken == "" {
		token.RefreshToken = refreshToken
	}
	return token, err
}

func (o OAuth) requestToken(ctx context.Context, values url.Values) (Token, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(o.tokenBase(), "/")+"/oauth2/token", strings.NewReader(values.Encode()))
	if err != nil {
		return Token{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := o.client().Do(request)
	if err != nil {
		return Token{}, err
	}
	defer response.Body.Close()
	var token Token
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return Token{}, fmt.Errorf("decode TIDAL token: %w", err)
	}
	if response.StatusCode/100 != 2 || token.AccessToken == "" {
		return Token{}, fmt.Errorf("TIDAL token request failed (%d)", response.StatusCode)
	}
	token.ExpiresAt = time.Now().Add(time.Duration(max(0, token.ExpiresIn-30)) * time.Second)
	return token, nil
}

func (o OAuth) scopes() string {
	if strings.TrimSpace(o.Scopes) != "" {
		return strings.TrimSpace(o.Scopes)
	}
	return defaultScopes
}

func (o OAuth) loginBase() string {
	if o.LoginBase != "" {
		return o.LoginBase
	}
	return "https://login.tidal.com"
}

func (o OAuth) tokenBase() string {
	if o.TokenBase != "" {
		return o.TokenBase
	}
	return "https://auth.tidal.com/v1"
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
