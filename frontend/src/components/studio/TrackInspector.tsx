import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { formatBpm } from '../../lib/format'
import type { SetTrack, Transition, TransitionFeedback } from '../../types'
import { Artwork } from '../common/Artwork'
import { CamelotKey } from '../common/CamelotKey'

type Props = {
  item?: SetTrack
  nextItem?: SetTrack
  incomingFeedback?: TransitionFeedback
  outgoingFeedback?: TransitionFeedback
}

/** Evidence panel: why the selected track sits here, and how it is meant to blend. */
export function TrackInspector({ item, nextItem, incomingFeedback, outgoingFeedback }: Props) {
  if (!item) return null
  const { track } = item

  return (
    <aside className="inspector panel scroll" aria-label="Track and transition inspector">
      <header className="inspector-head">
        <Artwork track={track} size={54} linked />
        <div>
          <span className="eyebrow">Track {String(item.position).padStart(2, '0')}</span>
          <h2 className="truncate">{track.title}</h2>
          <p className="truncate">{track.artist}</p>
        </div>
      </header>

      <dl className="facts">
        <div><dt>BPM</dt><dd className="num">{formatBpm(track.bpm)}</dd></div>
        <div><dt>Key</dt><dd><CamelotKey value={track.camelot} /> <span className="fact-note truncate">{track.musicalKey}</span></dd></div>
        <div><dt>Energy</dt><dd className="num">{Math.round(track.energy * 100)}</dd></div>
        <div><dt>Groove</dt><dd>{track.groove}</dd></div>
        <div><dt>Role</dt><dd>{track.role}</dd></div>
        <div><dt>Vocal</dt><dd className="num">{Math.round(track.vocal * 100)}</dd></div>
      </dl>

      {item.position > 1 && (
        <TransitionDetail
          heading="Blend in"
          icon={<ArrowDownToLine size={14} />}
          transition={item.transition}
          verdict={incomingFeedback?.verdict}
        />
      )}
      {nextItem && (
        <TransitionDetail
          heading={`Blend out into ${nextItem.track.title}`}
          icon={<ArrowUpFromLine size={14} />}
          transition={nextItem.transition}
          verdict={outgoingFeedback?.verdict}
        />
      )}

      <footer className="inspector-foot">
        <div className="inspector-foot-head">
          <span className="eyebrow">Provenance</span>
          <span className="badge ok">{Math.round(track.featureConfidence * 100)}% confidence</span>
        </div>
        <p>{track.featureProvenance}</p>
        <p className="muted">From {track.sourcePlaylist}</p>
      </footer>
    </aside>
  )
}

function TransitionDetail({ heading, icon, transition, verdict }: { heading: string; icon: React.ReactNode; transition: Transition; verdict?: string }) {
  const basis = transition.basis === 'metadata-only'
    ? 'metadata fit'
    : transition.basis === 'temporal' ? 'cue-window plan' : transition.basis || 'legacy score'

  return (
    <section className="transition">
      <div className="transition-head">
        <span className="eyebrow">{icon} {heading}</span>
        <strong className="num">{Math.round(transition.score * 100)}</strong>
      </div>
      <div className="transition-tags">
        <span className="badge">{basis}</span>
        <span className={`badge ${transition.risk === 'high' ? 'bad' : transition.risk === 'medium' ? 'warn' : 'ok'}`}>{transition.risk || 'unrated'} risk</span>
        <span className="badge">{Math.round(transition.confidence * 100)}% confidence</span>
        {verdict && <span className={`badge ${verdict === 'compatible' ? 'accent' : 'bad'}`}>{verdict === 'compatible' ? 'verified works' : 'heard a clash'}</span>}
      </div>
      <p className="transition-summary">{transition.summary}</p>
      {transition.plan && (
        <p className="transition-plan">
          <strong>{transition.plan.bars}-bar {transition.plan.style}</strong> · {transition.plan.fromCueId} → {transition.plan.toCueId} · bass exchange at bar {transition.plan.bassSwapBar}
          {transition.plan.renderValidationRequired ? ' · render check required' : ''}
        </p>
      )}
      <div className="components">
        {transition.components.map((component) => (
          <div key={component.name}>
            <span>{component.name}</span>
            <i><b style={{ width: `${Math.round(component.score * 100)}%` }} /></i>
            <strong className="num">{Math.round(component.score * 100)}</strong>
            <small>{component.note}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
