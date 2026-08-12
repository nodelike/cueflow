import { ChevronDown, Sparkles } from 'lucide-react'
import type { GenerateRequest, SpotifyPlaylist, Track } from '../types'
import { PlaylistPicker } from './PlaylistPicker'
import { RequiredTrackPicker } from './RequiredTrackPicker'

type Props = {
  value: GenerateRequest
  tracks: Track[]
  playlists: SpotifyPlaylist[]
  spotifyReady: boolean
  busy: boolean
  onChange: (request: GenerateRequest) => void
  onSyncSources: (ids: string[]) => Promise<void>
  onGenerate: () => void
}

const grooveOptions = ['afro', 'tribal', 'house', 'tech-house', 'techno']

export function GeneratorPanel({ value, tracks, playlists, spotifyReady, busy, onChange, onSyncSources, onGenerate }: Props) {
  function update<K extends keyof GenerateRequest>(key: K, next: GenerateRequest[K]) { onChange({ ...value, [key]: next }) }
  function toggleGroove(groove: string) {
    const selected = value.allowedGrooves.includes(groove)
    update('allowedGrooves', selected ? value.allowedGrooves.filter((item) => item !== groove) : [...value.allowedGrooves, groove])
  }
  const readyCount = value.sourcePlaylistIds.length === 0 ? tracks.length : tracks.filter((track) => track.sourcePlaylistIds?.some((id) => value.sourcePlaylistIds.includes(id))).length
  async function applySources(ids: string[]) {
    if (ids.length === 0) { update('sourcePlaylistIds', []); return }
    await onSyncSources(ids)
  }

  return (
    <aside className="brief-panel" aria-label="Set brief">
      <div className="brief-heading"><div><span>Set brief</span><h1>Build a set</h1></div><small>{readyCount} tracks ready</small></div>

      <label className="control wide"><span>Name</span><input value={value.name} onChange={(event) => update('name', event.target.value)} /></label>

      <div className="control-row">
        <label className="control"><span>Duration</span><select value={value.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.target.value))}>
          {[15, 30, 45, 60, 75, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
        </select></label>
        <label className="control"><span>Energy arc</span><select value={value.arc} onChange={(event) => update('arc', event.target.value)}>
          <option value="journey">Journey</option><option value="roller">Roller</option><option value="peak">Peak-time</option><option value="sunset">Sunset</option>
        </select></label>
      </div>

      <PlaylistPicker playlists={playlists} selectedIDs={value.sourcePlaylistIds} connected={spotifyReady} busy={busy} onApply={applySources} />

      <RequiredTrackPicker tracks={tracks} selectedIDs={value.requiredTrackIds} onChange={(ids) => update('requiredTrackIds', ids)} />

      <div className="groove-control"><div className="section-label"><span>Groove</span><small>{value.allowedGrooves.length ? `${value.allowedGrooves.length} selected` : 'Any'}</small></div>
        <div className="groove-options">
          <button type="button" className={value.allowedGrooves.length === 0 ? 'active' : ''} onClick={() => update('allowedGrooves', [])}>Any</button>
          {grooveOptions.map((groove) => <button type="button" key={groove} className={value.allowedGrooves.includes(groove) ? 'active' : ''} onClick={() => toggleGroove(groove)}>{groove}</button>)}
        </div>
      </div>

      <div className="control-row">
        <label className="control"><span>Start BPM</span><input type="number" value={value.startBpm} onChange={(event) => update('startBpm', Number(event.target.value))} /></label>
        <label className="control"><span>End BPM</span><input type="number" value={value.endBpm} onChange={(event) => update('endBpm', Number(event.target.value))} /></label>
      </div>

      <div className="variation-control"><span>Variations</span><div>
        {[2, 3, 4].map((count) => <button type="button" key={count} className={value.variationCount === count ? 'active' : ''} onClick={() => update('variationCount', count)}>{count}</button>)}
      </div></div>

      <details className="advanced-controls">
        <summary>Mixing preferences <ChevronDown size={14} /></summary>
        <label className="range-control"><span>Harmonic discipline <b>{Math.round(value.harmonicStrictness * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={value.harmonicStrictness} onChange={(event) => update('harmonicStrictness', Number(event.target.value))} /></label>
        <label className="range-control"><span>Surprise <b>{Math.round(value.exploration * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={value.exploration} onChange={(event) => update('exploration', Number(event.target.value))} /></label>
      </details>

      <button type="button" className="generate-button" onClick={onGenerate} disabled={busy}>{busy ? <span className="loading-dot" /> : <Sparkles size={16} />}{busy ? 'Building variations…' : 'Generate set'}</button>
      <p className="source-lock">Source playlists are read-only. Publishing always creates a new private Set Lab playlist.</p>
    </aside>
  )
}
