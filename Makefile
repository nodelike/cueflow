GO ?= go
PNPM ?= pnpm
WAILS ?= wails
DATABASE_URL ?= postgres://$(USER)@127.0.0.1:5432/cueflow?sslmode=disable

.PHONY: dev-api dev-ui migrate seed spotify-auth spotify-sync enrich-import test test-go test-ui test-e2e build fmt

dev-api:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/server

dev-ui:
	$(PNPM) --dir frontend dev --host 127.0.0.1

migrate:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow migrate

seed:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow seed

spotify-auth:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow spotify-auth

spotify-sync:
	@test -n "$(PLAYLIST_IDS)" || (echo "usage: make spotify-sync PLAYLIST_IDS='id1 id2'" >&2; exit 2)
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow spotify-sync $(PLAYLIST_IDS)

enrich-import:
	@test -n "$(FILE)" || (echo "usage: make enrich-import FILE=/path/to/enrichment.csv" >&2; exit 2)
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow enrich-import '$(FILE)'

test: test-go test-ui

test-go:
	DATABASE_URL='$(DATABASE_URL)' $(GO) test ./...

test-ui:
	$(PNPM) --dir frontend test --run

test-e2e:
	DATABASE_URL='$(DATABASE_URL)' $(PNPM) --dir frontend test:e2e

build:
	$(PNPM) --dir frontend build
	$(WAILS) build

fmt:
	$(GO) fmt ./...
	$(PNPM) --dir frontend exec prettier --write src
