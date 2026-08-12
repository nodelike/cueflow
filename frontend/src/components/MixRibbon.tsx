import type { CSSProperties } from 'react'
import type { SetDraft } from '../types'

type Props = { draft: SetDraft; selectedPosition: number; onSelect: (position: number) => void }

export function MixRibbon({ draft, selectedPosition, onSelect }: Props) {
  return (
    <div className="sequence-overview" aria-label={`${draft.name} mix timeline`}>
      <div className="sequence-line" aria-hidden="true" />
      {draft.tracks.map((item) => (
        <button
          type="button"
          key={item.track.id}
          className={selectedPosition === item.position ? 'selected' : ''}
          onPointerDown={() => onSelect(item.position)}
          onClick={() => onSelect(item.position)}
          style={{ '--energy': `${Math.max(7, Math.round(item.track.energy * 38))}px` } as CSSProperties}
          aria-label={`${item.position}. ${item.track.title} by ${item.track.artist}`}
          title={`${item.track.title} · ${item.track.bpm} BPM · ${item.track.camelot}`}
        >
          <i /><span>{String(item.position).padStart(2, '0')}</span>
        </button>
      ))}
    </div>
  )
}
