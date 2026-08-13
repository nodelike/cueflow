import { Dices, Sparkles, Waves } from 'lucide-react'
import type { GenerateRequest, Section, SourcePlaylist, Track } from '../../types'
import { Popover } from '../common/Popover'
import { PinSearch } from './PinSearch'

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

/** The whole brief on one strip: the frequent knobs inline, the rest one click away. */
export function BriefBar({ value, tracks, crates, eligibleCount, busy, onChange, onGenerate, onNavigate }: Props) {
  function update<K extends keyof GenerateRequest>(key: K, next: GenerateRequest[K]) {
    onChange({ ...value, [key]: next })
  }

  function toggleList(key: 'allowedGrooves' | 'sourcePlaylistIds' | 'requiredTrackIds', id: string) {
    const current = value[key]
    update(key, current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const crateLabel = value.sourcePlaylistIds.length === 0
    ? 'Whole library'
    : value.sourcePlaylistIds.length === 1
      ? crates.find((crate) => crate.id === value.sourcePlaylistIds[0])?.name ?? '1 crate'
      : `${value.sourcePlaylistIds.length} crates`

  return (
    <div className="brief-bar" aria-label="Set brief">
      <PinSearch tracks={tracks} pinnedIDs={value.requiredTrackIds} onPin={(id) => toggleList('requiredTrackIds', id)} />

      <label className="bar-field">
        <span className="eyebrow">Length</span>
        <select value={value.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.target.value))} aria-label="Set length">
          {[15, 30, 45, 60, 75, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
        </select>
      </label>

      <label className="bar-field">
        <span className="eyebrow">Arc</span>
        <select value={value.arc} onChange={(event) => update('arc', event.target.value)} aria-label="Energy arc">
          {arcs.map((arc) => <option key={arc.value} value={arc.value}>{arc.label}</option>)}
        </select>
      </label>

      <Popover label={<span className="truncate">{crateLabel}</span>} ariaLabel="Choose crates" width={264}>
        <div className="popover-head">
          <span className="eyebrow">Crates</span>
          <small>{eligibleCount} tracks ready</small>
        </div>
        {crates.length === 0 ? (
          <button type="button" className="brief-hint" onClick={() => onNavigate('sources')}>
            <Waves size={15} />
            <span>Sync a playlist in Sources to fill the master library.</span>
          </button>
        ) : (
          <div className="popover-list">
            <button type="button" className="chip" aria-pressed={value.sourcePlaylistIds.length === 0} onClick={() => update('sourcePlaylistIds', [])}>
              Whole library
            </button>
            {crates.map((crate) => (
              <button
                type="button"
                key={crate.id}
                className="chip"
                aria-pressed={value.sourcePlaylistIds.includes(crate.id)}
                onClick={() => toggleList('sourcePlaylistIds', crate.id)}
              >
                {crate.name}
              </button>
            ))}
          </div>
        )}
      </Popover>

      <Popover label="Tune" ariaLabel="Tune the brief" width={320}>
        <div className="popover-head"><span className="eyebrow">Brief</span></div>
        <label className="field">
          <span>Name</span>
          <input value={value.name} onChange={(event) => update('name', event.target.value)} />
        </label>

        <div className="popover-block">
          <div className="popover-head">
            <span className="eyebrow">Groove</span>
            <small>{value.allowedGrooves.length ? `${value.allowedGrooves.length} selected` : 'Any'}</small>
          </div>
          <div className="popover-list">
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
        </div>

        <div className="popover-block field-row">
          <label className="field">
            <span>Start BPM</span>
            <input type="number" value={value.startBpm} onChange={(event) => update('startBpm', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>End BPM</span>
            <input type="number" value={value.endBpm} onChange={(event) => update('endBpm', Number(event.target.value))} />
          </label>
        </div>

        <div className="popover-block">
          <div className="popover-head"><span className="eyebrow">Variations</span></div>
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
        </div>

        <div className="popover-block">
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
        </div>
      </Popover>

      <button type="button" className="btn primary generate" onClick={onGenerate} disabled={busy}>
        {busy ? <span className="spinner" /> : <Sparkles size={15} />}
        {busy ? 'Building…' : 'Generate'}
      </button>
    </div>
  )
}
