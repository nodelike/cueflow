import { AlertTriangle, ArrowRight, Mic2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { SetDraft, SetTrack } from '../types'

type Props = { draft: SetDraft; selectedPosition: number; onSelect: (position: number) => void }

const sourceColors: Record<string, string> = {
  'Afro Vibezz': '#d97757',
  'House Vibezz': '#d7b76c',
  'Tech House Vibezz': '#5ab9a8',
  'Techno Vibezz': '#7689d7',
}

export function MixRibbon({ draft, selectedPosition, onSelect }: Props) {
  return (
    <div className="ribbon-shell" aria-label={`${draft.name} mix timeline`}>
      <div className="ribbon-scale" aria-hidden="true"><span>ENTRY</span><span>PRESSURE</span><span>RELEASE</span></div>
      <div className="mix-ribbon">
        {draft.tracks.map((item, index) => (
          <TrackNode key={item.track.id} item={item} index={index} total={draft.tracks.length}
            selected={selectedPosition === item.position} onActivate={() => onSelect(item.position)} />
        ))}
      </div>
    </div>
  )
}

function TrackNode({ item, index, total, selected, onActivate }: {
  item: SetTrack; index: number; total: number; selected: boolean; onActivate: () => void
}) {
  const energyOffset = 82 - item.track.energy * 58
  const width = `${Math.max(8, 100 / total)}%`
  const color = sourceColors[item.track.sourcePlaylist] ?? '#a3a9b7'
  return (
    <div className="track-node-wrap" style={{ width }}>
      {index > 0 && (
        <div className={`transition-bridge risk-${item.transition.risk}`} title={item.transition.summary}>
          {item.transition.risk === 'high' ? <AlertTriangle size={12} /> : <ArrowRight size={12} />}
          <span>{Math.round(item.transition.score * 100)}</span>
        </div>
      )}
      <button type="button" className={`track-node ${selected ? 'selected' : ''}`} onPointerDown={onActivate} onClick={onActivate}
        style={{ '--track-color': color, '--energy-offset': `${energyOffset}px` } as CSSProperties}
        aria-label={`${item.position}. ${item.track.title} by ${item.track.artist}`}>
        <span className="track-energy-bar" />
        <span className="track-order">{item.position.toString().padStart(2, '0')}</span>
        <span className="track-title">{item.track.title}</span>
        <span className="track-artist">{item.track.artist}</span>
        <span className="track-metrics"><strong>{item.track.bpm}</strong> BPM <i>{item.track.camelot}</i></span>
        {item.track.vocal > 0.6 && <Mic2 className="vocal-mark" size={13} aria-label="Vocal-forward" />}
      </button>
    </div>
  )
}
