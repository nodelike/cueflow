import { AudioWaveform } from 'lucide-react'
import type { TrackWaveform, WaveformPoint } from '../types'

export type WaveformCue = {
  kind: 'in' | 'out'
  startSeconds: number
  endSeconds: number
}

type WaveformState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; value: TrackWaveform }

type Props = {
  title: string
  durationSeconds: number
  state: WaveformState
  cues: WaveformCue[]
}

const viewWidth = 1000
const viewHeight = 88
const center = viewHeight / 2
const amplitude = 37
const maxVisiblePoints = 360

export function WaveformPanel({ title, durationSeconds, state, cues }: Props) {
  const overview = state.status === 'ready' ? state.value : undefined
  const points = overview?.waveform ?? []
  const duration = overview?.durationSeconds || durationSeconds
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
    <section className="waveform-panel" aria-label={`Waveform for ${title}`}>
      <div className="waveform-heading">
        <h3><AudioWaveform size={13} /> Waveform</h3>
        <div className="waveform-legend" aria-label="Waveform layers">
          <span><i className="peak" /> Peak</span><span><i className="rms" /> RMS</span>
        </div>
      </div>

      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="waveform-state loading" role="status"><i /><span>Loading waveform…</span></div>
      ) : state.status === 'error' ? (
        <div className="waveform-state"><strong>Waveform unavailable</strong><span>Select the track again to retry.</span></div>
      ) : points.length === 0 ? (
        <div className="waveform-state"><strong>No full-track waveform yet</strong><span>Import an authorized recording analysis to see it here.</span></div>
      ) : (
        <>
          <div className="waveform-canvas">
            <svg
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={waveformLabel(title, visibleCues)}
            >
              <title>{waveformLabel(title, visibleCues)}</title>
              <g className="waveform-grid" aria-hidden="true">
                <line x1="250" y1="0" x2="250" y2={viewHeight} />
                <line x1="500" y1="0" x2="500" y2={viewHeight} />
                <line x1="750" y1="0" x2="750" y2={viewHeight} />
              </g>
              {visibleCues.map((cue) => <rect
                key={`${cue.kind}-${cue.startSeconds}`}
                className={`waveform-cue-window cue-${cue.kind}`}
                x={cue.start * viewWidth}
                y="1"
                width={Math.max(2, (cue.end - cue.start) * viewWidth)}
                height={viewHeight - 2}
                vectorEffect="non-scaling-stroke"
              />)}
              <line className="waveform-baseline" x1="0" y1={center} x2={viewWidth} y2={center} vectorEffect="non-scaling-stroke" />
              <path className="waveform-envelope peak" d={peakPath} />
              <path className="waveform-envelope rms" d={rmsPath} />
            </svg>
            {visibleCues.map((cue) => <span
              aria-hidden="true"
              key={`label-${cue.kind}-${cue.startSeconds}`}
              className={`waveform-cue-label cue-${cue.kind}`}
              style={{ left: `${cue.start * 100}%` }}
            >{cue.kind}</span>)}
          </div>
          <div className="waveform-timecode" aria-hidden="true"><span>00:00</span><span>{formatTimecode(duration / 2)}</span><span>{formatTimecode(duration)}</span></div>
          {visibleCues.length > 0 && <div className="waveform-cue-readout" aria-label="Planned cue windows">
            {visibleCues.map((cue) => <span key={`readout-${cue.kind}-${cue.startSeconds}`} className={`cue-${cue.kind}`}><i /> <b>{cue.kind}</b> {formatTimecode(cue.startSeconds)}–{formatTimecode(cue.endSeconds)}</span>)}
          </div>}
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
  const detail = cues.map((cue) => `${cue.kind === 'in' ? 'incoming' : 'outgoing'} cue ${formatTimecode(cue.startSeconds)} to ${formatTimecode(cue.endSeconds)}`).join('; ')
  return `Full-track peak and RMS waveform for ${title}${detail ? `; ${detail}` : ''}`
}

function formatTimecode(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
