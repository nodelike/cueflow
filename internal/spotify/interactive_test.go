package spotify

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestAuthorizeInteractiveStoresToken(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_ = json.NewEncoder(writer).Encode(Token{AccessToken: "access", RefreshToken: "refresh", ExpiresIn: 3600})
	}))
	defer tokenServer.Close()

	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	callbackAddress := probe.Addr().String()
	_ = probe.Close()
	redirectURI := "http://" + callbackAddress + "/callback"
	store := &memoryStore{}
	oauth := OAuth{ClientID: "client", RedirectURI: redirectURI, AccountsBase: tokenServer.URL}

	err = AuthorizeInteractive(context.Background(), oauth, store, func(authorizationURL string) error {
		parsed, err := url.Parse(authorizationURL)
		if err != nil {
			return err
		}
		callback := redirectURI + "?code=approved&state=" + url.QueryEscape(parsed.Query().Get("state"))
		go func() {
			client := &http.Client{Timeout: 2 * time.Second}
			response, requestErr := client.Get(callback)
			if requestErr == nil {
				_ = response.Body.Close()
			}
		}()
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if store.token.RefreshToken != "refresh" || store.token.AccessToken != "access" {
		t.Fatalf("token was not stored: %#v", store.token)
	}
}
