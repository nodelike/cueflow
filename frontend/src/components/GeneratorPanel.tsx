import { Dices, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { GenerateRequest } from '../types'

type Props = { value: GenerateRequest; busy: boolean; onChange: (request: GenerateRequest) => void; onGenerate: () => void }

const grooveOptions = ['afro', 'tribal', 'house', 'tech-house', 'techno']

export function GeneratorPanel({ value, busy, onChange, onGenerate }: Props) {
  function update<K extends keyof GenerateRequest>(key: K, next: GenerateRequest[K]) { onChange({ ...value, [key]: next }) }
  function toggleGroove(groove: string) {
    const selected = value.allowedGrooves.includes(groove)
    update('allowedGrooves', selected ? value.allowedGrooves.filter((item) => item !== groove) : [...value.allowedGrooves, groove])
  }
  return (
    <aside className="generator-panel">
      <div className="panel-title"><SlidersHorizontal size={17} /><div><span className="eyebrow">SET BRIEF</span><h2>Shape the room</h2></div></div>
      <label className="field wide"><span>Set name</span><input value={value.name} onChange={(e) => update('name', e.target.value)} /></label>
      <div className="field-grid">
        <label className="field"><span>Duration</span><select value={value.durationMinutes} onChange={(e) => update('durationMinutes', Number(e.target.value))}>
          {[15, 30, 45, 60, 75, 90].map((v) => <option key={v} value={v}>{v} min</option>)}</select></label>
        <label className="field"><span>Arc</span><select value={value.arc} onChange={(e) => update('arc', e.target.value)}>
          <option value="journey">Journey</option><option value="roller">Roller</option><option value="peak">Peak-time</option><option value="sunset">Sunset</option>
        </select></label>
      </div>
      <div className="field wide"><span>Groove palette · {value.allowedGrooves.length === 0 ? 'all crates' : `${value.allowedGrooves.length} selected`}</span>
        <div className="groove-palette">
          <button type="button" className={value.allowedGrooves.length === 0 ? 'active' : ''} onClick={() => update('allowedGrooves', [])}>Any</button>
          {grooveOptions.map((groove) => <button type="button" key={groove} className={value.allowedGrooves.includes(groove) ? 'active' : ''} onClick={() => toggleGroove(groove)}>{groove}</button>)}
        </div>
      </div>
      <label className="range-field"><span>Harmonic discipline <b>{Math.round(value.harmonicStrictness * 100)}%</b></span>
        <input type="range" min="0" max="1" step="0.01" value={value.harmonicStrictness} onChange={(e) => update('harmonicStrictness', Number(e.target.value))} /></label>
      <label className="range-field"><span>Surprise <b>{Math.round(value.exploration * 100)}%</b></span>
        <input type="range" min="0" max="1" step="0.01" value={value.exploration} onChange={(e) => update('exploration', Number(e.target.value))} /></label>
      <div className="field-grid">
        <label className="field"><span>Start BPM</span><input type="number" value={value.startBpm} onChange={(e) => update('startBpm', Number(e.target.value))} /></label>
        <label className="field"><span>End BPM</span><input type="number" value={value.endBpm} onChange={(e) => update('endBpm', Number(e.target.value))} /></label>
      </div>
      <label className="field wide"><span>Variations</span><div className="segmented">
        {[2, 3, 4].map((count) => <button key={count} type="button" className={value.variationCount === count ? 'active' : ''} onClick={() => update('variationCount', count)}>{count}</button>)}
      </div></label>
      <button type="button" className="generate-button" onClick={onGenerate} disabled={busy}>
        {busy ? <Dices className="spin" size={18} /> : <Sparkles size={18} />}{busy ? 'Searching combinations…' : 'Generate set variations'}
      </button>
      <p className="safety-note">Permanent playlists stay untouched. Only Set Lab drafts are writable.</p>
    </aside>
  )
}
