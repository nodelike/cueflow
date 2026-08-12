import { AudioWaveform } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { trackWaveform } from '../api'
import type { SetTrack, TrackWaveform, WaveformPoint } from '../types'

export type WaveformCue = {
  kind: 'in' | 'out'
  startSeconds: number
  endSeconds: number
}

type WaveformState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; value: TrackWaveform }

const viewWidth = 1600
const viewHeight = 112
const center = viewHeight / 2
const amplitude = 48
const maxVisiblePoints = 1200

export function WaveformPanel({ item, nextItem }: { item?: SetTrack; nextItem?: SetTrack }) {
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
    <section className="waveform-deck" aria-label={`Full waveform for ${track.title}`}>
      <header className="waveform-deck-header">
        <div className="waveform-track">
          <strong>{String(item.position).padStart(2, '0')}</strong>
          <div><span>Selected track</span><h2>{track.title}</h2><p>{track.artist}</p></div>
        </div>
        <div className="waveform-deck-meta">
          <span><b>{track.bpm}</b> BPM</span><span><b>{track.camelot || '—'}</b> key</span><span><b>{formatTimecode(duration)}</b> full track</span>
          <div className="waveform-legend" aria-label="Waveform layers"><span><i className="peak" /> Peak</span><span><i className="rms" /> RMS</span></div>
        </div>
      </header>

      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="waveform-state loading" role="status"><i /><span>Loading waveform…</span></div>
      ) : state.status === 'error' ? (
        <div className="waveform-state"><AudioWaveform size={18} /><strong>Waveform unavailable</strong><span>Select another track, then return to retry.</span></div>
      ) : points.length === 0 ? (
        <div className="waveform-state"><AudioWaveform size={18} /><strong>Full recording not linked</strong><span>Import or link the complete audio file to build this waveform.</span></div>
      ) : (
        <>
          <div className="waveform-canvas">
            <svg
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={waveformLabel(track.title, visibleCues)}
            >
              <title>{waveformLabel(track.title, visibleCues)}</title>
              <g className="waveform-grid" aria-hidden="true">
                <line x1="400" y1="0" x2="400" y2={viewHeight} />
                <line x1="800" y1="0" x2="800" y2={viewHeight} />
                <line x1="1200" y1="0" x2="1200" y2={viewHeight} />
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
