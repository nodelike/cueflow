import { useMemo, type CSSProperties } from 'react'
import type { SetDraft, TransitionFeedback } from '../types'

type Props = { draft: SetDraft; selectedPosition: number; feedback: TransitionFeedback[]; onSelect: (position: number) => void }

export function MixRibbon({ draft, selectedPosition, feedback, onSelect }: Props) {
  const verdictByTransition = useMemo(() => new Map(feedback.map((item) => [`${item.fromTrackId}\u0000${item.toTrackId}`, item.verdict])), [feedback])
  return (
    <div className="sequence-overview" aria-label={`${draft.name} mix timeline`}>
      <div className="sequence-line" aria-hidden="true" />
      {draft.tracks.map((item) => {
        const verdict = verdictByTransition.get(`${item.transition.fromTrackId}\u0000${item.transition.toTrackId}`)
        return <button
          type="button"
          key={item.track.id}
          className={[selectedPosition === item.position ? 'selected' : '', verdict ? `verdict-${verdict}` : ''].filter(Boolean).join(' ')}
          onPointerDown={() => onSelect(item.position)}
          onClick={() => onSelect(item.position)}
          style={{ '--energy': `${Math.max(7, Math.round(item.track.energy * 38))}px` } as CSSProperties}
          aria-label={`${item.position}. ${item.track.title} by ${item.track.artist}${verdict ? `, transition marked ${verdict}` : ''}`}
          title={`${item.track.title} · ${item.track.bpm} BPM · ${item.track.camelot}`}
        >
          <i /><span>{String(item.position).padStart(2, '0')}</span>
        </button>
      })}
    </div>
  )
}
