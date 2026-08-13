import { ChevronDown, Dices, Plus, Sparkles, Waves, X } from 'lucide-react'
import { useState } from 'react'
import type { GenerateRequest, Section, SourcePlaylist, Track } from '../../types'
import { Artwork } from '../common/Artwork'
import { TrackPicker } from './TrackPicker'

type Props = {
  value: GenerateRequest
  tracks: Track[]
  crates: SourcePlaylist[]
  eligibleCount: number
  busy: boolean
  onChange: (request: GenerateRequest) => void
  onGenerate: () => void
  onNavigate: (section: Section) => void
}

const grooves = ['afro', 'tribal', 'house', 'tech-house', 'techno']
const arcs = [
  { value: 'journey', label: 'Journey' },
  { value: 'roller', label: 'Roller' },
  { value: 'peak', label: 'Peak-time' },
  { value: 'sunset', label: 'Sunset' },
]

export function BriefPanel({ value, tracks, crates, eligibleCount, busy, onChange, onGenerate, onNavigate }: Props) {
  const [picking, setPicking] = useState(false)
  const required = value.requiredTrackIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))

  function update<K extends keyof GenerateRequest>(key: K, next: GenerateRequest[K]) {
    onChange({ ...value, [key]: next })
  }

  function toggleList(key: 'allowedGrooves' | 'sourcePlaylistIds' | 'requiredTrackIds', id: string) {
    const current = value[key]
    update(key, current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <aside className="brief" aria-label="Set brief">
      <div className="brief-scroll scroll">
        <section className="brief-group">
          <span className="eyebrow">Set</span>
          <label className="field">
            <span>Name</span>
            <input value={value.name} onChange={(event) => update('name', event.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Duration</span>
              <select value={value.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.target.value))}>
                {[15, 30, 45, 60, 75, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
              </select>
            </label>
            <label className="field">
              <span>Energy arc</span>
              <select value={value.arc} onChange={(event) => update('arc', event.target.value)}>
                {arcs.map((arc) => <option key={arc.value} value={arc.value}>{arc.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="brief-group">
          <div className="brief-group-head">
            <span className="eyebrow">Crates</span>
            <small>{eligibleCount} tracks ready</small>
          </div>
          {crates.length === 0 ? (
            <button type="button" className="brief-hint" onClick={() => onNavigate('sources')}>
              <Waves size={15} />
              <span>Sync a playlist in Sources to fill the master library.</span>
            </button>
          ) : (
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                aria-pressed={value.sourcePlaylistIds.length === 0}
                onClick={() => update('sourcePlaylistIds', [])}
              >
                Whole library
              </button>
              {crates.map((crate) => (
                <button
                  type="button"
                  key={crate.id}
                  className="chip"
                  aria-pressed={value.sourcePlaylistIds.includes(crate.id)}
                  onClick={() => toggleList('sourcePlaylistIds', crate.id)}
                  title={`${crate.trackCount} tracks`}
                >
                  {crate.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="brief-group">
          <div className="brief-group-head">
            <span className="eyebrow">Must play</span>
            <small>{required.length ? `${required.length} locked in` : 'Optional'}</small>
          </div>
          {required.length > 0 && (
            <ul className="required-list">
              {required.map((track) => (
                <li key={track.id}>
                  <Artwork track={track} size={30} />
                  <span className="required-name">
                    <strong className="truncate">{track.title}</strong>
                    <small className="truncate">{track.artist}</small>
                  </span>
                  <button type="button" className="btn sm icon ghost" onClick={() => toggleList('requiredTrackIds', track.id)} aria-label={`Remove ${track.title}`}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn wide dashed" onClick={() => setPicking(true)}>
            <Plus size={15} /> {required.length ? 'Add another track' : 'Choose tracks'}
          </button>
        </section>

        <section className="brief-group">
          <div className="brief-group-head">
            <span className="eyebrow">Sound</span>
            <small>{value.allowedGrooves.length ? `${value.allowedGrooves.length} grooves` : 'Any groove'}</small>
          </div>
          <div className="chip-row">
            <button type="button" className="chip" aria-pressed={value.allowedGrooves.length === 0} onClick={() => update('allowedGrooves', [])}>Any</button>
            {grooves.map((groove) => (
              <button
                type="button"
                key={groove}
                className="chip"
                aria-pressed={value.allowedGrooves.includes(groove)}
                onClick={() => toggleList('allowedGrooves', groove)}
              >
                {groove}
              </button>
            ))}
          </div>
          <div className="field-row">
            <label className="field">
              <span>Start BPM</span>
              <input type="number" value={value.startBpm} onChange={(event) => update('startBpm', Number(event.target.value))} />
            </label>
            <label className="field">
              <span>End BPM</span>
              <input type="number" value={value.endBpm} onChange={(event) => update('endBpm', Number(event.target.value))} />
            </label>
          </div>
        </section>

        <section className="brief-group">
          <div className="brief-group-head">
            <span className="eyebrow">Variations</span>
            <small>Compare directions</small>
          </div>
          <div className="segmented wide" role="group" aria-label="Variation count">
            {[2, 3, 4].map((count) => (
              <button
                type="button"
                key={count}
                className={value.variationCount === count ? 'active' : ''}
                aria-pressed={value.variationCount === count}
                onClick={() => update('variationCount', count)}
              >
                {count}
              </button>
            ))}
          </div>
        </section>

        <details className="advanced">
          <summary>Mixing preferences <ChevronDown size={15} /></summary>
          <label className="range">
            <span>Harmonic discipline <b>{Math.round(value.harmonicStrictness * 100)}%</b></span>
            <input type="range" min="0" max="1" step="0.01" value={value.harmonicStrictness} onChange={(event) => update('harmonicStrictness', Number(event.target.value))} />
          </label>
          <label className="range">
            <span>Surprise <b>{Math.round(value.exploration * 100)}%</b></span>
            <input type="range" min="0" max="1" step="0.01" value={value.exploration} onChange={(event) => update('exploration', Number(event.target.value))} />
          </label>
          <div className="seed-control">
            <span>Seed <b className="num">{value.seed}</b></span>
            <button type="button" className="btn sm" onClick={() => update('seed', Math.floor(Math.random() * 99999))}>
              <Dices size={14} /> Reroll
            </button>
          </div>
        </details>
      </div>

      <div className="brief-actions">
        <button type="button" className="btn primary lg wide" onClick={onGenerate} disabled={busy}>
          {busy ? <span className="spinner" /> : <Sparkles size={16} />}
          {busy ? 'Building variations…' : 'Generate set'}
        </button>
        <p>Source playlists stay read-only. Publishing always creates a new private Set Lab playlist.</p>
      </div>

      {picking && (
        <TrackPicker
          tracks={tracks}
          selectedIDs={value.requiredTrackIds}
          onToggle={(id) => toggleList('requiredTrackIds', id)}
          onClose={() => setPicking(false)}
        />
      )}
    </aside>
  )
}
