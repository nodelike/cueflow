import { Check, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Track } from '../types'

type Props = {
  tracks: Track[]
  selectedIDs: string[]
  onChange: (ids: string[]) => void
}

// Search should follow how people remember a title, not how punctuation was
// stored by the distributor. This folds Don't, DON’T, and dont to the same
// value, and also makes accents, separators, and extra spaces irrelevant.
function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function RequiredTrackPicker({ tracks, selectedIDs, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = tracks.filter((track) => selectedIDs.includes(track.id))

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const results = useMemo(() => {
    const needle = normalizeSearchText(query)
    return tracks
      .filter((track) => !track.featureNeedsReview)
      .filter((track) => !needle || normalizeSearchText(`${track.title} ${track.artist}`).includes(needle))
      .slice(0, 50)
  }, [query, tracks])

  function toggle(id: string) {
    onChange(selectedIDs.includes(id) ? selectedIDs.filter((item) => item !== id) : [...selectedIDs, id])
  }

  return (
    <section className="must-play">
      <div className="section-label"><span>Must play</span><small>Every selected track is guaranteed</small></div>
      {selected.length > 0 && <div className="must-play-list">
        {selected.map((track) => <div key={track.id} className="must-play-item">
          <span><strong>{track.title}</strong><small>{track.artist}</small></span>
          <button type="button" onClick={() => toggle(track.id)} aria-label={`Remove ${track.title}`}><X size={14} /></button>
        </div>)}
      </div>}
      <button type="button" className="add-track-button" onClick={() => setOpen(true)}><Plus size={15} /> {selected.length ? 'Add another track' : 'Choose tracks'}</button>

      {open && <div className="picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
        <div className="track-picker" role="dialog" aria-modal="true" aria-labelledby="track-picker-title">
          <header><div><h2 id="track-picker-title">Choose must-play tracks</h2><p>Selected tracks will always appear in every variation.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close track picker"><X size={18} /></button></header>
          <label className="track-search"><Search size={17} /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or artist" aria-label="Search tracks" /></label>
          <div className="picker-results" aria-label="Track search results">
            {results.length === 0 ? <p className="no-results">No matching tracks.</p> : results.map((track) => {
              const active = selectedIDs.includes(track.id)
              return <button type="button" key={track.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => toggle(track.id)}>
                <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                <em>{track.bpm} BPM · {track.camelot}</em>
                <i>{active ? <Check size={15} /> : <Plus size={15} />}</i>
              </button>
            })}
          </div>
          <footer><span>{selectedIDs.length} selected</span><button type="button" onClick={() => setOpen(false)}>Done</button></footer>
        </div>
      </div>}
    </section>
  )
}
