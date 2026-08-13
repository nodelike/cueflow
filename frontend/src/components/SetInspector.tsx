import { ArrowRight, Check, Headphones, X } from 'lucide-react'
import type { SetTrack, TransitionFeedback, TransitionVerdict } from '../types'
import { CamelotKey } from './CamelotKey'
import { TrackArtwork } from './TrackArtwork'

type Props = {
  item?: SetTrack
  nextItem?: SetTrack
  feedback?: TransitionFeedback
  saving?: boolean
  onFeedback: (fromTrackId: string, toTrackId: string, verdict: TransitionVerdict) => void
}

export function SetInspector({ item, nextItem, feedback, saving = false, onFeedback }: Props) {
  if (!item) return null
  return (
    <aside className="track-inspector" aria-label="Track and transition inspector">
      <header className="inspector-title"><TrackArtwork track={item.track} linked /><div><span>Track {String(item.position).padStart(2, '0')}</span><h2>{item.track.title}</h2><p>{item.track.artist}</p></div></header>
      {nextItem && <section className="transition-check" aria-label={`Field test ${item.track.title} into ${nextItem.track.title}`}>
        <header><span><Headphones size={13} /> Field test</span><strong>{feedback ? 'Remembered' : nextItem.transition.plan ? `${nextItem.transition.plan.bars} bars` : 'Untested'}</strong></header>
        <div className="transition-pair">
          <div><span>Now</span><strong>{item.track.title}</strong></div>
          <ArrowRight size={17} aria-hidden="true" />
          <div><span>Next</span><strong>{nextItem.track.title}</strong></div>
        </div>
        <div className="verdict-actions" role="group" aria-label="Did this transition work?">
          <button type="button" className="works" disabled={saving} aria-pressed={feedback?.verdict === 'compatible'} onClick={() => onFeedback(item.track.id, nextItem.track.id, 'compatible')}><Check size={14} /> Works</button>
          <button type="button" className="clashes" disabled={saving} aria-pressed={feedback?.verdict === 'incompatible'} onClick={() => onFeedback(item.track.id, nextItem.track.id, 'incompatible')}><X size={14} /> Doesn't</button>
        </div>
        <small className="verdict-status" aria-live="polite">{saving ? 'Saving what you heard…' : feedback?.verdict === 'compatible' ? 'Marked compatible · future sets can reuse it' : feedback?.verdict === 'incompatible' ? 'Marked incompatible · future sets will steer away' : 'Try it, then tap what your ears say'}</small>
      </section>}
      <dl className="track-metadata">
        <div><dt>BPM</dt><dd>{item.track.bpm}</dd></div>
        <div><dt>Key</dt><dd><CamelotKey value={item.track.camelot} /></dd></div>
        <div><dt>Energy</dt><dd>{Math.round(item.track.energy * 100)}%</dd></div>
        <div><dt>Groove</dt><dd>{item.track.groove}</dd></div>
      </dl>
      {item.position > 1 && <section className="transition-detail">
        <div className="transition-heading"><span><ArrowRight size={14} /> Transition in · {item.transition.basis === 'metadata-only' ? 'metadata fit' : item.transition.basis === 'temporal' ? 'cue-window plan' : item.transition.basis || 'legacy score'}</span><strong title={`${item.transition.risk || 'unknown'} risk · ${Math.round(item.transition.confidence * 100)}% confidence`}>{Math.round(item.transition.score * 100)}</strong></div>
        <p>{item.transition.summary}</p>
        {item.transition.plan && <p><strong>{item.transition.plan.bars}-bar {item.transition.plan.style}</strong> · {item.transition.plan.fromCueId} → {item.transition.plan.toCueId} · bass exchange at bar {item.transition.plan.bassSwapBar}{item.transition.plan.renderValidationRequired ? ' · render check required' : ''}</p>}
        <div className="transition-components">{item.transition.components.map((component) => <div key={component.name}>
          <span>{component.name}</span><i><b style={{ width: `${component.score * 100}%` }} /></i><strong>{Math.round(component.score * 100)}</strong><small>{component.note}</small>
        </div>)}</div>
      </section>}
      <footer><span>{Math.round(item.track.featureConfidence * 100)}% feature confidence</span><p>{item.track.featureProvenance}</p></footer>
    </aside>
  )
}
