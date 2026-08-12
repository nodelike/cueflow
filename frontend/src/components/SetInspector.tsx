import { Activity, ChevronRight, CircleGauge, Music2, Waves } from 'lucide-react'
import type { SetTrack } from '../types'
import { Fact } from './Fact'

export function SetInspector({ item }: { item?: SetTrack }) {
  if (!item) return null
  return (
    <aside className="inspector" aria-label="Track and transition inspector">
      <div className="inspector-heading">
        <span className="eyebrow">CUE {item.position.toString().padStart(2, '0')}</span>
        <h2>{item.track.title}</h2><p>{item.track.artist}</p>
      </div>
      <div className="track-facts">
        <Fact icon={<CircleGauge size={16} />} label="Tempo" value={`${item.track.bpm} BPM`} />
        <Fact icon={<Music2 size={16} />} label="Key" value={`${item.track.musicalKey} · ${item.track.camelot}`} />
        <Fact icon={<Activity size={16} />} label="Energy" value={`${Math.round(item.track.energy * 100)}%`} />
        <Fact icon={<Waves size={16} />} label="Groove" value={item.track.groove} />
      </div>
      {item.position > 1 && (
        <div className="transition-card">
          <div className="transition-title"><span>Transition in</span><strong>{Math.round(item.transition.score * 100)}</strong></div>
          <p>{item.transition.summary}</p>
          <div className="component-list">
            {item.transition.components.map((component) => (
              <div key={component.name} className="component-row">
                <span className="component-name"><ChevronRight size={12} /> {component.name}</span>
                <div className="component-meter"><i style={{ width: `${component.score * 100}%` }} /></div>
                <b>{Math.round(component.score * 100)}</b><small>{component.note}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <footer className="provenance">
        <span>Feature confidence {Math.round(item.track.featureConfidence * 100)}%</span>
        <small>{item.track.featureProvenance}</small>
      </footer>
    </aside>
  )
}
