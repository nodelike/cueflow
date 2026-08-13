import { Check, Disc3, Library, Link2, RefreshCw, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatSince, plural } from '../lib/format'
import { matches } from '../lib/search'
import type { SourcePlaylist, SpotifyPlaylist, TidalStatus, Track } from '../types'
import { SectionHeader } from '../components/shell/SectionHeader'

type Props = {
  playlists: SpotifyPlaylist[]
  crates: SourcePlaylist[]
  tracks: Track[]
  spotifyReady: boolean
  tidal: TidalStatus
  busy: boolean
  syncing: string[]
  onSync: (playlistIDs: string[]) => void
  onConnect: () => void
  onConnectTidal: () => void
  onProbeTidal: () => void
}

const publishedPrefix = 'Set Lab —'

/** Platform crates and their sync state against the master library. */
export function SourcesView({ playlists, crates, tracks, spotifyReady, tidal, busy, syncing, onSync, onConnect, onConnectTidal, onProbeTidal }: Props) {
  const [query, setQuery] = useState('')

  const inLibrary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const track of tracks) {
      for (const id of track.sourcePlaylistIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [tracks])

  const syncedAt = useMemo(() => new Map(crates.map((crate) => [crate.id, crate.syncedAt])), [crates])

  // Without a Spotify session the master library still knows its own crates.
  const rows: SpotifyPlaylist[] = spotifyReady
    ? playlists
    : crates.map((crate) => ({ ID: crate.id, Name: crate.name, Kind: crate.kind, Writable: false, ImageURL: crate.imageUrl ?? '', TrackCount: crate.trackCount, Synced: true }))

  const visible = rows.filter((playlist) => matches(playlist.Name, query))
  const published = visible.filter((playlist) => playlist.Name.startsWith(publishedPrefix))
  const sources = visible.filter((playlist) => !playlist.Name.startsWith(publishedPrefix))
  const synced = sources.filter((playlist) => playlist.Synced)
  const available = sources.filter((playlist) => !playlist.Synced)

  return (
    <div className="section">
      <SectionHeader
        title="Sources"
        subtitle={`${plural(crates.length, 'crate')} in the master library · ${plural(tracks.length, 'track')} · source playlists are never modified`}
      >
        <label className="search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playlists"
            aria-label="Search playlists"
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!spotifyReady || busy || synced.length === 0}
          onClick={() => onSync(synced.map((playlist) => playlist.ID))}
        >
          <RefreshCw size={14} /> Re-sync all
        </button>
      </SectionHeader>

      <div className="section-body sources scroll">
        <div className="platforms">
          <article className={`platform${spotifyReady ? ' connected' : ''}`}>
            <div className="platform-mark spotify"><Disc3 size={20} /></div>
            <div className="platform-body">
              <h2>Spotify</h2>
              <p>{spotifyReady ? `${playlists.length} playlists visible · ${crates.length} synced into the library` : 'Connect to browse and sync your playlists.'}</p>
            </div>
            {spotifyReady
              ? <span className="badge ok"><Check size={12} /> Connected</span>
              : <button type="button" className="btn primary" disabled={busy} onClick={onConnect}><Link2 size={14} /> Connect</button>}
          </article>

          <article className={`platform${tidal.connected ? ' connected' : ''}`}>
            <div className="platform-mark tidal"><Sparkles size={19} /></div>
            <div className="platform-body">
              <h2>TIDAL</h2>
              <p>{!tidal.configured
                ? 'Add CUEFLOW_TIDAL_CLIENT_ID and restart Cueflow.'
                : tidal.connected
                  ? 'Connected for disposable preview playlists. Verify writes before publishing.'
                  : 'Connect to publish generated variations for immediate testing in djay Pro.'}</p>
            </div>
            {tidal.connected
              ? <button type="button" className="btn" disabled={busy} onClick={onProbeTidal}><Check size={14} /> Verify access</button>
              : <button type="button" className="btn primary" disabled={busy || !tidal.configured} onClick={onConnectTidal}><Link2 size={14} /> Connect</button>}
          </article>
        </div>

        {!spotifyReady && crates.length === 0 && (
          <div className="empty sources-empty">
            <Library size={28} />
            <h2>No crates yet</h2>
            <p>Connect Spotify to pick the permanent playlists Cueflow should mirror into the master library.</p>
          </div>
        )}

        <PlaylistGroup
          title="In the master library"
          hint="Synced read-only. Generation draws from these."
          playlists={synced}
          inLibrary={inLibrary}
          syncedAt={syncedAt}
          syncing={syncing}
          disabled={!spotifyReady || busy}
          onSync={onSync}
        />
        <PlaylistGroup
          title="Available on Spotify"
          hint="Sync a playlist to add its tracks to the master library."
          playlists={available}
          inLibrary={inLibrary}
          syncedAt={syncedAt}
          syncing={syncing}
          disabled={!spotifyReady || busy}
          onSync={onSync}
        />
        {published.length > 0 && (
          <PlaylistGroup
            title="Published by Cueflow"
            hint="Disposable Set Lab playlists. Outputs, not sources."
            playlists={published}
            inLibrary={inLibrary}
            syncedAt={syncedAt}
            syncing={syncing}
            disabled
            onSync={onSync}
          />
        )}
      </div>
    </div>
  )
}

type GroupProps = {
  title: string
  hint: string
  playlists: SpotifyPlaylist[]
  inLibrary: Map<string, number>
  syncedAt: Map<string, string>
  syncing: string[]
  disabled: boolean
  onSync: (playlistIDs: string[]) => void
}

function PlaylistGroup({ title, hint, playlists, inLibrary, syncedAt, syncing, disabled, onSync }: GroupProps) {
  if (playlists.length === 0) return null
  return (
    <section className="crate-group">
      <header>
        <div>
          <span className="eyebrow">{title}</span>
          <p>{hint}</p>
        </div>
        <span className="num muted">{playlists.length}</span>
      </header>
      <ul className="crate-list panel">
        {playlists.map((playlist) => {
          const busyRow = syncing.includes(playlist.ID)
          const count = inLibrary.get(playlist.ID) ?? 0
          const since = syncedAt.get(playlist.ID)
          return (
            <li key={playlist.ID} className="crate">
              {playlist.ImageURL
                ? <img className="crate-cover" src={playlist.ImageURL} alt="" loading="lazy" />
                : <span className="crate-cover fallback"><Library size={16} /></span>}
              <span className="crate-name">
                <strong className="truncate">{playlist.Name}</strong>
                <small className="truncate">
                  {plural(playlist.TrackCount, 'track')}
                  {playlist.Synced && count > 0 ? ` · ${count} in library` : ''}
                  {playlist.Synced && since ? ` · synced ${formatSince(since)}` : ''}
                </small>
              </span>
              {playlist.Synced
                ? <span className="badge ok"><Check size={12} /> Synced</span>
                : <span className="badge">Not synced</span>}
              <button
                type="button"
                className={`btn sm${playlist.Synced ? '' : ' primary'}`}
                disabled={disabled || busyRow}
                onClick={() => onSync([playlist.ID])}
                aria-label={`${playlist.Synced ? 'Re-sync' : 'Sync'} ${playlist.Name}`}
              >
                {busyRow ? <span className="spinner" /> : <RefreshCw size={13} />}
                {busyRow ? 'Syncing…' : playlist.Synced ? 'Re-sync' : 'Sync'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
