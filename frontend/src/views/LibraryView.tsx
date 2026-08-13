import { AlertTriangle, CheckCircle2, ExternalLink, Library, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatBpm, formatClock, formatDate, plural } from '../lib/format'
import { matches } from '../lib/search'
import type { Section, SourcePlaylist, Track } from '../types'
import { Artwork } from '../components/common/Artwork'
import { CamelotKey } from '../components/common/CamelotKey'
import { EnergyMeter } from '../components/common/EnergyMeter'
import { SectionHeader } from '../components/shell/SectionHeader'

type Props = {
  tracks: Track[]
  crates: SourcePlaylist[]
  onNavigate: (section: Section) => void
}

type Sort = 'added' | 'title' | 'bpm' | 'energy'

const sorts: Array<{ value: Sort; label: string }> = [
  { value: 'added', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'bpm', label: 'BPM' },
  { value: 'energy', label: 'Energy' },
]

/** The master library: everything generation is allowed to draw from. */
export function LibraryView({ tracks, crates, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [crate, setCrate] = useState('')
  const [groove, setGroove] = useState('')
  const [onlyUnverified, setOnlyUnverified] = useState(false)
  const [sort, setSort] = useState<Sort>('added')
  const [selectedID, setSelectedID] = useState('')

  const grooves = useMemo(
    () => [...new Set(tracks.map((track) => track.groove).filter(Boolean))].sort(),
    [tracks],
  )
  const unverified = tracks.filter((track) => track.featureNeedsReview).length

  const visible = useMemo(() => {
    const filtered = tracks.filter((track) => (
      matches(`${track.title} ${track.artist} ${track.sourcePlaylist}`, query)
      && (!crate || track.sourcePlaylistIds?.includes(crate))
      && (!groove || track.groove === groove)
      && (!onlyUnverified || track.featureNeedsReview)
    ))
    return filtered.sort((left, right) => {
      if (sort === 'title') return left.title.localeCompare(right.title)
      if (sort === 'bpm') return left.bpm - right.bpm
      if (sort === 'energy') return right.energy - left.energy
      return right.addedAt.localeCompare(left.addedAt)
    })
  }, [crate, groove, onlyUnverified, query, sort, tracks])

  const selected = visible.find((track) => track.id === selectedID)

  return (
    <div className="section">
      <SectionHeader
        title="Library"
        subtitle={`${plural(tracks.length, 'track')} · ${plural(crates.length, 'crate')} · ${unverified === 0 ? 'all verified' : `${unverified} need research`}`}
      >
        <label className="search library-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, artist, crate"
            aria-label="Search the library"
          />
        </label>
        <label className="inline-field">
          <span className="eyebrow">Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort library">
            {sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </SectionHeader>

      <div className="section-body library">
        <div className="library-main">
          <div className="filter-bar">
            <div className="chip-row">
              <button type="button" className="chip" aria-pressed={crate === ''} onClick={() => setCrate('')}>All crates</button>
              {crates.map((option) => (
                <button type="button" key={option.id} className="chip" aria-pressed={crate === option.id} onClick={() => setCrate(option.id)}>
                  {option.name}
                </button>
              ))}
            </div>
            <div className="chip-row">
              <button type="button" className="chip" aria-pressed={groove === ''} onClick={() => setGroove('')}>Any groove</button>
              {grooves.map((option) => (
                <button type="button" key={option} className="chip" aria-pressed={groove === option} onClick={() => setGroove(option)}>
                  {option}
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={onlyUnverified} onClick={() => setOnlyUnverified((current) => !current)}>
                <AlertTriangle size={13} /> Needs research
              </button>
            </div>
          </div>

          <div className="table panel" aria-label="Master library">
            <div className="table-head">
              <span>#</span>
              <span />
              <span>Track</span>
              <span>BPM</span>
              <span>Key</span>
              <span>Energy</span>
              <span>Groove</span>
              <span>Role</span>
              <span>Crate</span>
              <span>Status</span>
            </div>
            <div className="table-rows scroll">
              {visible.length === 0 ? (
                <p className="table-empty">No tracks match these filters.</p>
              ) : visible.map((track, index) => (
                <button
                  type="button"
                  key={track.id}
                  className={`table-row${track.id === selectedID ? ' selected' : ''}`}
                  onClick={() => setSelectedID(track.id === selectedID ? '' : track.id)}
                  aria-label={`${track.title} by ${track.artist}`}
                >
                  <span className="num muted">{index + 1}</span>
                  <Artwork track={track} size={34} />
                  <span className="table-name">
                    <strong className="truncate">{track.title}</strong>
                    <small className="truncate">{track.artist}</small>
                  </span>
                  <span className="num">{formatBpm(track.bpm)}</span>
                  <CamelotKey value={track.camelot} />
                  <span className="table-energy"><EnergyMeter value={track.energy} label={`${track.title} energy`} /></span>
                  <span className="truncate muted">{track.groove || '—'}</span>
                  <span className="truncate muted">{track.role || '—'}</span>
                  <span className="truncate muted">{track.sourcePlaylist}</span>
                  <span className={`badge ${track.featureNeedsReview ? 'warn' : 'ok'}`}>
                    {track.featureNeedsReview ? 'needs ears' : 'verified'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {selected ? (
          <aside className="detail panel scroll" aria-label="Track detail">
            <header className="detail-head">
              <Artwork track={selected} size={64} linked />
              <div>
                <h2 className="truncate">{selected.title}</h2>
                <p className="truncate">{selected.artist}</p>
              </div>
            </header>
            <dl className="facts">
              <div><dt>BPM</dt><dd className="num">{formatBpm(selected.bpm)}</dd></div>
              <div><dt>Key</dt><dd><CamelotKey value={selected.camelot} /></dd></div>
              <div><dt>Energy</dt><dd className="num">{Math.round(selected.energy * 100)}</dd></div>
              <div><dt>Vocal</dt><dd className="num">{Math.round(selected.vocal * 100)}</dd></div>
              <div><dt>Groove</dt><dd>{selected.groove || '—'}</dd></div>
              <div><dt>Role</dt><dd>{selected.role || '—'}</dd></div>
              <div><dt>Length</dt><dd className="num">{formatClock(selected.durationSeconds)}</dd></div>
              <div><dt>Added</dt><dd>{formatDate(selected.addedAt)}</dd></div>
            </dl>
            <section className="detail-block">
              <span className="eyebrow">Evidence</span>
              <p className="detail-provenance">{selected.featureProvenance}</p>
              <span className={`badge ${selected.featureNeedsReview ? 'warn' : 'ok'}`}>
                {selected.featureNeedsReview
                  ? <><AlertTriangle size={12} /> excluded from generation</>
                  : <><CheckCircle2 size={12} /> {Math.round(selected.featureConfidence * 100)}% confidence</>}
              </span>
            </section>
            <section className="detail-block">
              <span className="eyebrow">Crate</span>
              <p>{selected.sourcePlaylist}</p>
            </section>
            <div className="detail-actions">
              {selected.spotifyId && (
                <a className="btn wide" href={`https://open.spotify.com/track/${selected.spotifyId}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open in Spotify
                </a>
              )}
              {selected.featureNeedsReview && (
                <button type="button" className="btn primary wide" onClick={() => onNavigate('research')}>
                  Review by ear
                </button>
              )}
            </div>
          </aside>
        ) : (
          <aside className="detail panel detail-idle" aria-label="Track detail">
            <Library size={22} />
            <p>Select a track to see its measured facts and evidence.</p>
          </aside>
        )}
      </div>
    </div>
  )
}
