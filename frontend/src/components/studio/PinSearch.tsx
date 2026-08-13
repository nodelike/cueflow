import { Pin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatBpm } from '../../lib/format'
import { matches } from '../../lib/search'
import type { Track } from '../../types'
import { Artwork } from '../common/Artwork'
import { CamelotKey } from '../common/CamelotKey'

type Props = {
  tracks: Track[]
  pinnedIDs: string[]
  onPin: (id: string) => void
}

/** Search the library and pin a track straight into the next generation. */
export function PinSearch({ tracks, pinnedIDs, onPin }: Props) {
  const [query, setQuery] = useState('')
  const holder = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    return tracks
      .filter((track) => !track.featureNeedsReview)
      .filter((track) => matches(`${track.title} ${track.artist}`, query))
      .slice(0, 8)
  }, [query, tracks])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) setQuery('')
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [])

  function pin(id: string) {
    onPin(id)
    setQuery('')
  }

  return (
    <div className="pin-search" ref={holder}>
      <label className="search">
        <Search size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('')
            if (event.key === 'Enter' && results[0]) pin(results[0].id)
          }}
          placeholder="Search a track to must-play"
          aria-label="Search tracks to must-play"
        />
      </label>
      {query.trim() !== '' && (
        <div className="pin-results" aria-label="Track search results">
          {results.length === 0 ? <p className="pin-empty">No matching tracks.</p> : results.map((track) => {
            const pinned = pinnedIDs.includes(track.id)
            return (
              <button type="button" key={track.id} className={pinned ? 'pinned' : ''} onClick={() => pin(track.id)}>
                <Artwork track={track} size={32} />
                <span className="pin-name">
                  <strong className="truncate">{track.title}</strong>
                  <small className="truncate">{track.artist}</small>
                </span>
                <span className="pin-facts num">{formatBpm(track.bpm)} <CamelotKey value={track.camelot} /></span>
                <Pin size={14} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
