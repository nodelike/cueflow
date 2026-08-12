GO ?= go
PNPM ?= pnpm
WAILS ?= wails
PYTHON ?= python3
DATABASE_URL ?= postgres://$(USER)@127.0.0.1:5432/cueflow?sslmode=disable
AIR_VERSION ?= v1.67.3
TOOLS_DIR ?= $(CURDIR)/.tools
AIR ?= $(TOOLS_DIR)/air

.PHONY: dev dev-tools dev-api dev-ui bindings migrate seed-demo spotify-auth spotify-sync enrich-import analysis-validate analysis-import test test-go test-ui test-analysis test-e2e build fmt

dev: $(AIR)
	@echo "Starting Cueflow debug mode: Air reloads Go; Wails/Vite hot-reloads the UI."
	DATABASE_URL='$(DATABASE_URL)' WAILS='$(WAILS)' $(AIR) -c .air.toml

dev-tools: $(AIR)

$(AIR):
	@mkdir -p '$(TOOLS_DIR)'
	GOBIN='$(TOOLS_DIR)' $(GO) install github.com/air-verse/air@$(AIR_VERSION)

dev-api:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/server

dev-ui:
	$(PNPM) --dir frontend dev --host 127.0.0.1

bindings:
	$(WAILS) generate module

migrate:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow migrate

seed-demo:
	@echo "Seeding the fictional reference catalog for isolated development only."
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow seed

spotify-auth:
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow spotify-auth

spotify-sync:
	@test -n "$(PLAYLIST_IDS)" || (echo "usage: make spotify-sync PLAYLIST_IDS='id1 id2'" >&2; exit 2)
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow spotify-sync $(PLAYLIST_IDS)

enrich-import:
	@test -n "$(FILE)" || (echo "usage: make enrich-import FILE=/path/to/enrichment.csv" >&2; exit 2)
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow enrich-import '$(FILE)'

analysis-import:
	@test -n "$(FILE)" || (echo "usage: make analysis-import FILE=/path/to/track-analysis.json" >&2; exit 2)
	DATABASE_URL='$(DATABASE_URL)' $(GO) run ./cmd/cueflow analysis-import '$(FILE)'

analysis-validate:
	@test -n "$(FILE)" || (echo "usage: make analysis-validate FILE=/path/to/track-analysis.json" >&2; exit 2)
	$(GO) run ./cmd/cueflow analysis-validate '$(FILE)'

test: test-go test-ui test-analysis

test-go:
	DATABASE_URL='$(DATABASE_URL)' $(GO) test ./...

test-ui:
	$(PNPM) --dir frontend test --run

test-analysis:
	$(PYTHON) -m py_compile scripts/analyze_previews.py scripts/analyze_tracks.py scripts/crosscheck_mixgraph.py scripts/prepare_enrichment.py

test-e2e:
	DATABASE_URL='$(DATABASE_URL)' $(PNPM) --dir frontend test:e2e

build:
	$(PNPM) --dir frontend build
	$(WAILS) build

fmt:
	$(GO) fmt ./...
	$(PNPM) --dir frontend exec prettier --write src
