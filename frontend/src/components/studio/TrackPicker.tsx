import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState, useEffect } from 'react'
import { matches } from '../../lib/search'
import { formatBpm } from '../../lib/format'
import type { Track } from '../../types'
import { Artwork } from '../common/Artwork'
import { CamelotKey } from '../common/CamelotKey'
import { Dialog } from '../common/Dialog'

type Props = {
  tracks: Track[]
  selectedIDs: string[]
  onToggle: (id: string) => void
  onClose: () => void
}

/** Search the master library for tracks that must appear in every variation. */
export function TrackPicker({ tracks, selectedIDs, onToggle, onClose }: Props) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const results = useMemo(() => tracks
    .filter((track) => !track.featureNeedsReview)
    .filter((track) => matches(`${track.title} ${track.artist}`, query))
    .slice(0, 60), [query, tracks])

  return (
    <Dialog
      title="Choose must-play tracks"
      description="Selected tracks appear in every variation."
      onClose={onClose}
      footer={
        <footer>
          <span>{selectedIDs.length} selected</span>
          <button type="button" className="btn primary" onClick={onClose}>Done</button>
        </footer>
      }
    >
      <label className="search">
        <Search size={16} />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title or artist"
          aria-label="Search tracks"
        />
      </label>
      <div className="picker-results scroll" aria-label="Track search results">
        {results.length === 0 ? <p className="picker-empty">No matching tracks.</p> : results.map((track) => {
          const active = selectedIDs.includes(track.id)
          return (
            <button type="button" key={track.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => onToggle(track.id)}>
              <Artwork track={track} size={38} />
              <span className="picker-name">
                <strong className="truncate">{track.title}</strong>
                <small className="truncate">{track.artist}</small>
              </span>
              <span className="picker-facts num">{formatBpm(track.bpm)} <CamelotKey value={track.camelot} /></span>
              <i>{active ? <Check size={15} /> : <Plus size={15} />}</i>
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
