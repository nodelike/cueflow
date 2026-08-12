import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { trackWaveform } from '../api'
import type { SetTrack, TrackWaveform } from '../types'
import { CamelotKey } from './CamelotKey'
import { TrackArtwork } from './TrackArtwork'
import { WaveformPanel, type WaveformCue } from './WaveformPanel'

type WaveformState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; value: TrackWaveform }

export function SetInspector({ item, nextItem }: { item?: SetTrack; nextItem?: SetTrack }) {
  const requests = useRef(new Map<string, Promise<TrackWaveform>>())
  const [waveform, setWaveform] = useState<WaveformState>({ status: 'idle' })
  const trackID = item?.track.id

  useEffect(() => {
    if (!trackID) {
      setWaveform({ status: 'idle' })
      return
    }
    let current = true
    let request = requests.current.get(trackID)
    if (!request) {
      request = trackWaveform(trackID)
      requests.current.set(trackID, request)
    }
    setWaveform({ status: 'loading' })
    void request.then((value) => {
      if (current) setWaveform({ status: 'ready', value })
    }).catch(() => {
      requests.current.delete(trackID)
      if (current) setWaveform({ status: 'error' })
    })
    return () => { current = false }
  }, [trackID])

  if (!item) return null
  const cues: WaveformCue[] = []
  if (item.position > 1 && item.transition.plan) {
    cues.push({ kind: 'in', startSeconds: item.transition.plan.toStartSeconds, endSeconds: item.transition.plan.toEndSeconds })
  }
  if (nextItem?.transition.plan && nextItem.transition.fromTrackId === item.track.id) {
    cues.push({ kind: 'out', startSeconds: nextItem.transition.plan.fromStartSeconds, endSeconds: nextItem.transition.plan.fromEndSeconds })
  }
  return (
    <aside className="track-inspector" aria-label="Track and transition inspector">
      <header className="inspector-title"><TrackArtwork track={item.track} linked /><div><span>Track {String(item.position).padStart(2, '0')}</span><h2>{item.track.title}</h2><p>{item.track.artist}</p></div></header>
      <dl className="track-metadata">
        <div><dt>BPM</dt><dd>{item.track.bpm}</dd></div>
        <div><dt>Key</dt><dd><CamelotKey value={item.track.camelot} /></dd></div>
        <div><dt>Energy</dt><dd>{Math.round(item.track.energy * 100)}%</dd></div>
        <div><dt>Groove</dt><dd>{item.track.groove}</dd></div>
      </dl>
      <WaveformPanel
        title={item.track.title}
        durationSeconds={item.track.durationSeconds}
        state={waveform}
        cues={cues}
      />
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
