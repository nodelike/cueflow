import { Check, Library, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SpotifyPlaylist } from '../types'

type Props = {
  playlists: SpotifyPlaylist[]
  selectedIDs: string[]
  connected: boolean
  busy: boolean
  onApply: (ids: string[]) => Promise<void>
}

function fold(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

export function PlaylistPicker({ playlists, selectedIDs, connected, busy, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [draftIDs, setDraftIDs] = useState<string[]>(selectedIDs)
  const [query, setQuery] = useState('')
  const [applying, setApplying] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = playlists.filter((playlist) => selectedIDs.includes(playlist.ID))

  useEffect(() => {
    if (!open) return
    setDraftIDs(selectedIDs)
    setQuery('')
    searchRef.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !applying) setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, selectedIDs])

  const results = useMemo(() => {
    const needle = fold(query)
    return playlists.filter((playlist) => !needle || fold(playlist.Name).includes(needle))
  }, [playlists, query])

  function toggle(id: string) {
    setDraftIDs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function apply() {
    setApplying(true)
    try { await onApply(draftIDs); setOpen(false) }
    catch { /* The app-level banner reports the sync failure; keep this picker open. */ }
    finally { setApplying(false) }
  }

  return <section className="source-crates">
    <div className="section-label"><span>Source crates</span><small>{selectedIDs.length ? `${selectedIDs.length} selected` : 'All synced'}</small></div>
    {selected.length > 0 && <div className="source-summary">
      <div className="cover-stack">{selected.slice(0, 4).map((playlist) => playlist.ImageURL ? <img key={playlist.ID} src={playlist.ImageURL} alt="" /> : <span key={playlist.ID}><Library size={12} /></span>)}</div>
      <span>{selected.length === 1 ? selected[0].Name : `${selected.length} Spotify playlists`}</span>
    </div>}
    <button type="button" className="choose-sources-button" disabled={!connected || busy} onClick={() => setOpen(true)}><Library size={14} /> {connected ? 'Choose playlists' : 'Connect Spotify to choose'}</button>

    {open && <div className="picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !applying) setOpen(false) }}>
      <div className="track-picker playlist-picker" role="dialog" aria-modal="true" aria-labelledby="playlist-picker-title">
        <header><div><h2 id="playlist-picker-title">Choose source crates</h2><p>Selected playlists are synced read-only into Cueflow.</p></div><button type="button" onClick={() => setOpen(false)} disabled={applying} aria-label="Close playlist picker"><X size={18} /></button></header>
        <label className="track-search"><Search size={17} /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your playlists" aria-label="Search playlists" /></label>
        <div className="picker-results playlist-results" aria-label="Spotify playlists">
          {results.length === 0 ? <p className="no-results">No matching Spotify playlists.</p> : results.map((playlist) => {
            const active = draftIDs.includes(playlist.ID)
            return <button type="button" key={playlist.ID} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => toggle(playlist.ID)}>
              {playlist.ImageURL ? <img className="playlist-cover" src={playlist.ImageURL} alt="" /> : <span className="playlist-cover fallback"><Library size={15} /></span>}
              <span><strong>{playlist.Name}</strong><small>{playlist.TrackCount} tracks · {playlist.Synced ? 'Synced' : 'Not synced yet'}</small></span>
              <i>{active ? <Check size={15} /> : null}</i>
            </button>
          })}
        </div>
        <footer><span>{draftIDs.length ? `${draftIDs.length} selected` : 'All locally synced tracks'}</span><button type="button" disabled={applying} onClick={() => void apply()}>{applying ? 'Syncing…' : draftIDs.length ? 'Sync & use' : 'Use all synced'}</button></footer>
      </div>
    </div>}
  </section>
}
