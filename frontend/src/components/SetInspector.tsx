import { ArrowRight } from 'lucide-react'
import type { SetTrack } from '../types'
import { CamelotKey } from './CamelotKey'
import { TrackArtwork } from './TrackArtwork'

export function SetInspector({ item }: { item?: SetTrack }) {
  if (!item) return null
  return (
    <aside className="track-inspector" aria-label="Track and transition inspector">
      <header className="inspector-title"><TrackArtwork track={item.track} linked /><div><span>Track {String(item.position).padStart(2, '0')}</span><h2>{item.track.title}</h2><p>{item.track.artist}</p></div></header>
      <dl className="track-metadata">
        <div><dt>BPM</dt><dd>{item.track.bpm}</dd></div>
        <div><dt>Key</dt><dd><CamelotKey value={item.track.camelot} /></dd></div>
        <div><dt>Energy</dt><dd>{Math.round(item.track.energy * 100)}%</dd></div>
        <div><dt>Groove</dt><dd>{item.track.groove}</dd></div>
      </dl>
      {item.position > 1 && <section className="transition-detail">
        <div className="transition-heading"><span><ArrowRight size={14} /> Transition in</span><strong>{Math.round(item.transition.score * 100)}</strong></div>
        <p>{item.transition.summary}</p>
        <div className="transition-components">{item.transition.components.map((component) => <div key={component.name}>
          <span>{component.name}</span><i><b style={{ width: `${component.score * 100}%` }} /></i><strong>{Math.round(component.score * 100)}</strong><small>{component.note}</small>
        </div>)}</div>
      </section>}
      <footer><span>{Math.round(item.track.featureConfidence * 100)}% feature confidence</span><p>{item.track.featureProvenance}</p></footer>
    </aside>
  )
}
