import type { CSSProperties } from 'react'
import { padPosition } from '../../lib/format'
import type { SetDraft } from '../../types'

type Props = {
  draft: SetDraft
  selectedPosition: number
  onSelect: (position: number) => void
}

/** Whole-set energy at a glance, and the fastest way to jump around it. */
export function EnergyRibbon({ draft, selectedPosition, onSelect }: Props) {
  return (
    <div className="ribbon" aria-label={`${draft.name} energy timeline`}>
      {draft.tracks.map((item) => (
        <button
          type="button"
          key={item.track.id}
          className={selectedPosition === item.position ? 'selected' : ''}
          style={{ '--energy': `${Math.max(12, Math.round(item.track.energy * 100))}%` } as CSSProperties}
          onClick={() => onSelect(item.position)}
          aria-label={`Jump to ${item.position}. ${item.track.title}`}
          title={`${padPosition(item.position)} · ${item.track.title} · ${item.track.bpm} BPM · ${item.track.camelot}`}
        >
          <i />
        </button>
      ))}
    </div>
  )
}
