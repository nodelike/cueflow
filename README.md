# Cueflow

Cueflow is a local-first DJ set laboratory. It synchronizes permanent Spotify
crates, stores explainable musical features in PostgreSQL, generates multiple
set variations, visualizes their tempo/key/energy flow, and publishes only to
disposable Set Lab playlists.

Source crates are chosen from the connected user's Spotify playlists. Cueflow
syncs the selected playlists read-only and never removes, reorders, or adds
tracks in those permanent sources.

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
make spotify-sync PLAYLIST_IDS='spotify_playlist_id another_playlist_id'
```

The desktop app can list the connected account's playlists and sync selected
source crates directly, so the CLI IDs are only needed for headless workflows.

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

### Full-track waveform and cue analysis

Preview research does **not** unlock cue-aware transition scoring. To analyze
recordings you are authorized to use, create a manifest containing the exact
catalog ID and a local full-track audio path:

```json
{
  "tracks": [
    {"trackId": "spotify-track-id", "path": "/absolute/path/to/recording.wav"}
  ]
}
```

Run the full-file analyzer, validate its versioned JSON without touching the
database, then import it atomically:

```sh
.venv/bin/python scripts/analyze_tracks.py manifest.json track-analysis.json
make analysis-validate FILE="$PWD/track-analysis.json"
make analysis-import FILE="$PWD/track-analysis.json"
```

The analyzer fingerprints the source file and emits a downsampled RMS/peak
waveform envelope, beat/downbeat estimates, structural sections, two-second
STFT/loudness/band/percussive/vocal-likelihood/chroma frames, and ranked
16-bar cue candidates. The database checks the measured duration against the
catalog (2% or three seconds, whichever is greater), so a 30-second preview
cannot masquerade as full-track temporal evidence. Reusing the same
track/fingerprint/analyzer identity with different evidence is rejected.

When both sides of an edge have valid temporal analysis, set generation scores
actual exit/entry windows and stores a versioned transition plan with cue
times, style, phrase length, tempo adjustment, bass-swap bar, gain/EQ/crossfader
automation, evidence confidence, and risk. Otherwise the UI says
`metadata fit`; it does not imply that audio was inspected. Temporal plans
still require a rendered overlap check—Cueflow does not yet render, listen to,
or master the proposed blend. See [docs/MIX_ENGINE.md](docs/MIX_ENGINE.md) for
the scoring contract and the remaining path to production-grade mixes.

The set brief's **Groove palette** can isolate or deliberately combine `afro`,
`tribal`, `house`, `tech-house`, and `techno`. Leaving every chip off searches
the whole catalog. BPM endpoints are optimized across elapsed set time. Tempo
compatibility uses relative percentage change with explicit half/double-time
handling; temporal plans still require beat-grid and time-stretch validation
on a render.

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
