package tidal

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"
)

func AuthorizeInteractive(ctx context.Context, oauth OAuth, store TokenStore, opener func(string) error) error {
	authorization, err := oauth.Begin()
	if err != nil {
		return err
	}
	redirect, err := url.Parse(oauth.RedirectURI)
	if err != nil {
		return fmt.Errorf("parse TIDAL redirect URI: %w", err)
	}
	listener, err := net.Listen("tcp", redirect.Host)
	if err != nil {
		return fmt.Errorf("listen for TIDAL callback on %s: %w", redirect.Host, err)
	}
	defer listener.Close()

	result := make(chan error, 1)
	var finish sync.Once
	complete := func(value error) { finish.Do(func() { result <- value }) }
	mux := http.NewServeMux()
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	mux.HandleFunc(redirect.Path, func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Query().Get("state") != authorization.State {
			http.Error(writer, "Cueflow rejected an invalid OAuth state.", http.StatusBadRequest)
			complete(fmt.Errorf("TIDAL OAuth state mismatch"))
			return
		}
		code := request.URL.Query().Get("code")
		if code == "" {
			http.Error(writer, "TIDAL did not return an authorization code.", http.StatusBadRequest)
			complete(fmt.Errorf("TIDAL authorization failed: %s", request.URL.Query().Get("error")))
			return
		}
		token, err := oauth.Exchange(request.Context(), code, authorization.Verifier)
		if err == nil {
			err = store.Save(token)
		}
		if err != nil {
			http.Error(writer, "Cueflow could not securely store TIDAL access.", http.StatusInternalServerError)
			complete(err)
			return
		}
		writer.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = writer.Write([]byte("<h1>Cueflow is connected to TIDAL.</h1><p>You can close this tab and return to Cueflow.</p>"))
		complete(nil)
	})
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			complete(err)
		}
	}()
	if err := opener(authorization.URL); err != nil {
		return fmt.Errorf("open TIDAL authorization: %w", err)
	}

	select {
	case err := <-result:
		shutdown, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
		return err
	case <-time.After(3 * time.Minute):
		return fmt.Errorf("TIDAL authorization timed out")
	case <-ctx.Done():
		return ctx.Err()
	}
}
