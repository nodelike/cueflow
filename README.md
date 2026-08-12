# Cueflow

Cueflow is a local-first DJ set laboratory. It synchronizes permanent Spotify
crates, stores explainable musical features in PostgreSQL, generates multiple
set variations, visualizes their tempo/key/energy flow, and publishes only to
disposable Set Lab playlists.

The permanent source playlists are treated as read-only:

- House Vibezz
- Afro Vibezz
- Tech House Vibezz
- Techno Vibezz
- Techno, Afro, Soul & EDM (combined master)

## Stack

- Go 1.26 domain engine and API
- PostgreSQL 16+ persistence
- React 19 + TypeScript interface
- Wails v2 desktop shell
- Vitest, Playwright, and Go integration tests

## Local development

The default database URL uses the current macOS user and a local database named
`cueflow`:

```sh
createdb cueflow
make migrate
make seed
make dev-api
```

In another terminal:

```sh
make dev-ui
```

Open `http://127.0.0.1:34115`. The browser development build talks to the Go
API at `http://127.0.0.1:8787`; the packaged desktop build calls the same core
service through Wails bindings.

Connect Spotify with PKCE and store the refresh token in macOS Keychain:

```sh
make spotify-auth
make spotify-sync
```

The packaged desktop app also has a **Connect Spotify** button. It opens the
same PKCE consent flow and writes the resulting token directly to Keychain;
Cueflow does not require or store a Spotify client secret.

Synced tracks without verified BPM/key remain in the catalog with a research
flag and are excluded from generation. Cueflow never invents musical features.
Open **Research** in the app to review them by ear and save BPM, key/Camelot,
energy, groove family, vocal presence, set role, source evidence, and a
confidence score. Each save creates separate timestamped observations for all
seven features.

For a larger research batch, prepare a UTF-8 CSV with this exact header and
import it atomically:

```csv
track_id,bpm,musical_key,camelot,energy,groove,vocal,role,source,confidence
spotify-track-id,127.8,A minor,8A,0.81,tech-house,0.20,builder,"manual audio review + https://source.example",0.93
```

```sh
make enrich-import FILE=/absolute/path/to/enrichment.csv
```

Recommended controlled vocabularies are `afro`, `tribal`, `house`,
`tech-house`, and `techno` for groove; and `opener`, `builder`, `bridge`,
`lifter`, `peak`, `reset`, `vocal`, and `closer` for set role. The batch is
validated before commit: an invalid or unknown track rolls the entire import
back.

### Reproducible catalog research

The checked-in `research/` audit was built from exact Spotify identities, not
artist-level genre assumptions:

1. `scripts/analyze_previews.py` analyzes every recording's public preview for
   beat/onset periodicity, chroma/key, RMS energy, harmonic/percussive balance,
   dynamic range, and vocal-space proxies.
2. `scripts/crosscheck_mixgraph.py` performs an exact-title search for every
   track and accepts only an exact Spotify ID or a same-title/artist/duration
   recording match. Missing matches stay explicitly marked `preview-only`.
3. `scripts/prepare_enrichment.py` merges the independent observations,
   records disagreements, applies the small documented conflict-resolution
   table, and emits both the import and the full per-track audit.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/analyze_previews.py
.venv/bin/python scripts/crosscheck_mixgraph.py
.venv/bin/python scripts/prepare_enrichment.py
make enrich-import FILE="$PWD/research/enrichment.csv"
```

`research/research-audit.csv` is the human-readable final ledger;
`research/preview-analysis.csv` and `research/mixgraph-crosscheck.csv` preserve
the independent inputs. A public catalog tag can resolve a conflict, but it
never replaces structural audio analysis by itself.

The set brief's **Groove palette** can isolate or deliberately combine `afro`,
`tribal`, `house`, `tech-house`, and `techno`. Leaving every chip off searches
the whole catalog. BPM endpoints are optimized across the full curve, while
transition tempo flow still penalizes abrupt beat-grid jumps.

To use an isolated PostgreSQL container instead:

```sh
docker compose up -d postgres
DATABASE_URL='postgres://cueflow@127.0.0.1:55432/cueflow?sslmode=disable' make migrate
```

## Quality checks

```sh
make test
make test-e2e
make build
```

The generator quality matrix covers 180 set drafts across four energy arcs,
three durations, five deterministic seeds, and three variations. The E2E suite
also verifies PostgreSQL-backed review provenance and the full generation,
comparison, and transition-inspection workflow.

## Safety contract

Cueflow never removes tracks from permanent playlists. Publishing is restricted
to playlists created by Cueflow with the `Set Lab —` prefix. Track facts retain
their source and confidence so conflicting BPM/key data is visible rather than
silently overwritten.
