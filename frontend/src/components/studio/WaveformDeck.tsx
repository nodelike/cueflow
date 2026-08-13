import { AudioWaveform } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { trackWaveform } from '../../api'
import { formatBpm, formatClock, padPosition } from '../../lib/format'
import type { SetTrack, TrackWaveform, WaveformPoint } from '../../types'

export type WaveformCue = { kind: 'in' | 'out'; startSeconds: number; endSeconds: number }

type WaveformState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; value: TrackWaveform }

const viewWidth = 1600
const viewHeight = 112
const center = viewHeight / 2
const amplitude = 48
const maxVisiblePoints = 1200

/** Full-track envelope for the selected recording, with its planned cue windows. */
export function WaveformDeck({ item, nextItem }: { item?: SetTrack; nextItem?: SetTrack }) {
  const requests = useRef(new Map<string, Promise<TrackWaveform>>())
  const [state, setState] = useState<WaveformState>({ status: 'idle' })
  const trackID = item?.track.id

  useEffect(() => {
    if (!trackID) {
      setState({ status: 'idle' })
      return
    }
    let current = true
    let request = requests.current.get(trackID)
    if (!request) {
      request = trackWaveform(trackID)
      requests.current.set(trackID, request)
    }
    setState({ status: 'loading' })
    void request.then((value) => {
      if (current) setState({ status: 'ready', value })
    }).catch(() => {
      requests.current.delete(trackID)
      if (current) setState({ status: 'error' })
    })
    return () => { current = false }
  }, [trackID])

  if (!item) return null
  const { track } = item
  const cues: WaveformCue[] = []
  if (item.position > 1 && item.transition.plan) {
    cues.push({ kind: 'in', startSeconds: item.transition.plan.toStartSeconds, endSeconds: item.transition.plan.toEndSeconds })
  }
  if (nextItem?.transition.plan && nextItem.transition.fromTrackId === track.id) {
    cues.push({ kind: 'out', startSeconds: nextItem.transition.plan.fromStartSeconds, endSeconds: nextItem.transition.plan.fromEndSeconds })
  }
  const overview = state.status === 'ready' ? state.value : undefined
  const points = overview?.waveform ?? []
  const duration = overview?.durationSeconds || track.durationSeconds
  const visiblePoints = downsample(points, maxVisiblePoints)
  const peakPath = envelopePath(visiblePoints, 'peak')
  const rmsPath = envelopePath(visiblePoints, 'rms')
  const visibleCues = cues.flatMap((cue) => {
    if (duration <= 0 || cue.endSeconds <= cue.startSeconds) return []
    const start = clamp(cue.startSeconds / duration, 0, 1)
    const end = clamp(cue.endSeconds / duration, 0, 1)
    if (end <= start) return []
    return [{ ...cue, start, end }]
  })

  return (
    <section className="deck panel" aria-label={`Full waveform for ${track.title}`}>
      <header className="deck-head">
        <div className="deck-track">
          <strong className="num">{padPosition(item.position)}</strong>
          <div>
            <span className="eyebrow">Now inspecting</span>
            <h2 className="truncate">{track.title}</h2>
            <p className="truncate">{track.artist}</p>
          </div>
        </div>
        <div className="deck-facts">
          <span><b className="num">{formatBpm(track.bpm)}</b> bpm</span>
          <span><b className="num">{track.camelot || '—'}</b> key</span>
          <span><b className="num">{formatClock(duration)}</b> length</span>
          <div className="deck-legend" aria-label="Waveform layers">
            <span><i className="peak" /> Peak</span>
            <span><i className="rms" /> RMS</span>
          </div>
        </div>
      </header>

      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="deck-state" role="status"><span className="spinner" /><span>Loading waveform…</span></div>
      ) : state.status === 'error' ? (
        <div className="deck-state"><AudioWaveform size={17} /><strong>Waveform unavailable</strong><span>Select another track, then return to retry.</span></div>
      ) : points.length === 0 ? (
        <div className="deck-state"><AudioWaveform size={17} /><strong>Full recording not linked</strong><span>Import or link the complete audio file to build this waveform.</span></div>
      ) : (
        <>
          <div className="deck-canvas">
            <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" role="img" aria-label={waveformLabel(track.title, visibleCues)}>
              <title>{waveformLabel(track.title, visibleCues)}</title>
              <g className="deck-grid" aria-hidden="true">
                <line x1="400" y1="0" x2="400" y2={viewHeight} />
                <line x1="800" y1="0" x2="800" y2={viewHeight} />
                <line x1="1200" y1="0" x2="1200" y2={viewHeight} />
              </g>
              {visibleCues.map((cue) => (
                <rect
                  key={`${cue.kind}-${cue.startSeconds}`}
                  className={`deck-cue cue-${cue.kind}`}
                  x={cue.start * viewWidth}
                  y="1"
                  width={Math.max(2, (cue.end - cue.start) * viewWidth)}
                  height={viewHeight - 2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line className="deck-baseline" x1="0" y1={center} x2={viewWidth} y2={center} vectorEffect="non-scaling-stroke" />
              <path className="deck-envelope peak" d={peakPath} />
              <path className="deck-envelope rms" d={rmsPath} />
            </svg>
            {visibleCues.map((cue) => (
              <span
                aria-hidden="true"
                key={`label-${cue.kind}-${cue.startSeconds}`}
                className={`deck-cue-label cue-${cue.kind}`}
                style={{ left: `${cue.start * 100}%` }}
              >
                {cue.kind}
              </span>
            ))}
          </div>
          <div className="deck-footer">
            <div className="deck-timecode num" aria-hidden="true">
              <span>00:00</span><span>{formatClock(duration / 2)}</span><span>{formatClock(duration)}</span>
            </div>
            {visibleCues.length > 0 && (
              <div className="deck-cues num" aria-label="Planned cue windows">
                {visibleCues.map((cue) => (
                  <span key={`readout-${cue.kind}-${cue.startSeconds}`} className={`cue-${cue.kind}`}>
                    <i /> <b>{cue.kind}</b> {formatClock(cue.startSeconds)}–{formatClock(cue.endSeconds)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function envelopePath(points: WaveformPoint[], field: 'peak' | 'rms') {
  if (points.length === 0) return ''
  const plotted = points.length === 1 ? [points[0], points[0]] : points
  const upper = plotted.map((point, index) => {
    const x = index / (plotted.length - 1) * viewWidth
    const y = center - clamp(point[field], 0, 1) * amplitude
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  })
  const lower = plotted.map((point, index) => {
    const x = index / (plotted.length - 1) * viewWidth
    const y = center + clamp(point[field], 0, 1) * amplitude
    return `L${x.toFixed(2)},${y.toFixed(2)}`
  }).reverse()
  return `${upper.join(' ')} ${lower.join(' ')} Z`
}

function downsample(points: WaveformPoint[], limit: number) {
  if (points.length <= limit) return points
  return Array.from({ length: limit }, (_, index) => {
    const start = Math.floor(index * points.length / limit)
    const end = Math.max(start + 1, Math.floor((index + 1) * points.length / limit))
    const bucket = points.slice(start, end)
    return {
      startSeconds: bucket[0].startSeconds,
      endSeconds: bucket[bucket.length - 1].endSeconds,
      peak: Math.max(...bucket.map((point) => point.peak)),
      rms: Math.sqrt(bucket.reduce((sum, point) => sum + point.rms ** 2, 0) / bucket.length),
    }
  })
}

function waveformLabel(title: string, cues: Array<WaveformCue & { start: number; end: number }>) {
  const detail = cues.map((cue) => `${cue.kind === 'in' ? 'incoming' : 'outgoing'} cue ${formatClock(cue.startSeconds)} to ${formatClock(cue.endSeconds)}`).join('; ')
  return `Full-track peak and RMS waveform for ${title}${detail ? `; ${detail}` : ''}`
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
