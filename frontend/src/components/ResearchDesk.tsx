import { Check, ExternalLink, Headphones, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Track, TrackEnrichment } from '../types'
import { TrackArtwork } from './TrackArtwork'

type Props = {
  tracks: Track[]
  busy: boolean
  onSave: (input: TrackEnrichment) => Promise<void>
}

const grooves = ['afro', 'tribal', 'house', 'tech-house', 'techno']
const roles = ['opener', 'builder', 'bridge', 'lifter', 'peak', 'reset', 'vocal', 'closer']

export function ResearchDesk({ tracks, busy, onSave }: Props) {
  const [selectedID, setSelectedID] = useState(tracks[0]?.id ?? '')
  const selected = tracks.find((track) => track.id === selectedID) ?? tracks[0]
  const [form, setForm] = useState<TrackEnrichment>(() => blank(selected))

  useEffect(() => {
    const next = tracks.find((track) => track.id === selectedID) ?? tracks[0]
    if (next && next.id !== selectedID) setSelectedID(next.id)
    setForm(blank(next))
  }, [selectedID, tracks])

  if (!selected) {
    return (
      <section className="research-empty">
        <ShieldCheck size={36} />
        <span className="eyebrow">RESEARCH QUEUE CLEAR</span>
        <h1>Every synced track is reviewed.</h1>
        <p>New Spotify arrivals will land here until BPM, key, feel, role, and evidence are verified.</p>
      </section>
    )
  }

  const patch = (value: Partial<TrackEnrichment>) => setForm((current) => ({ ...current, ...value }))

  return (
    <div className="research-desk">
      <aside className="research-queue">
        <div className="queue-heading"><span className="eyebrow">NEEDS HUMAN EARS</span><strong>{tracks.length}</strong><small>pending</small></div>
        {tracks.map((track, index) => (
          <button type="button" key={track.id} className={track.id === selected.id ? 'active' : ''} onClick={() => setSelectedID(track.id)}>
            <span>{String(index + 1).padStart(2, '0')}</span><TrackArtwork track={track} /><div><strong>{track.title}</strong><small>{track.artist}</small></div><em>{track.sourcePlaylist}</em>
          </button>
        ))}
      </aside>

      <section className="research-form">
        <div className="research-title">
          <div className="research-track-title"><TrackArtwork track={selected} linked /><div><span className="eyebrow">TRACK DOSSIER</span><h1>{selected.title}</h1><p>{selected.artist} · {selected.sourcePlaylist}</p></div></div>
          {selected.spotifyUri && <a href={`https://open.spotify.com/track/${selected.spotifyId}`} target="_blank" rel="noreferrer">Open in Spotify <ExternalLink size={13} /></a>}
        </div>

        <div className="listening-note"><Headphones size={18} /><div><strong>Listen beyond the store tag.</strong><span>Judge the kick and bass relationship, percussion pocket, phrase density, vocal dominance, breakdown length, and where this record works in an arc.</span></div></div>

        <form onSubmit={(event) => { event.preventDefault(); void onSave(form) }}>
          <fieldset>
            <legend>Measured identity</legend>
            <label><span>BPM</span><input required type="number" min="40" max="220" step="0.01" value={form.bpm || ''} onChange={(event) => patch({ bpm: Number(event.target.value) })} /></label>
            <label><span>Musical key</span><input required placeholder="A minor" value={form.musicalKey} onChange={(event) => patch({ musicalKey: event.target.value })} /></label>
            <label><span>Camelot</span><input required pattern="(?:[1-9]|1[0-2])[ABab]" placeholder="8A" value={form.camelot} onChange={(event) => patch({ camelot: event.target.value.toUpperCase() })} /></label>
          </fieldset>
          <fieldset>
            <legend>Structural feel</legend>
            <label><span>Groove</span><select value={form.groove} onChange={(event) => patch({ groove: event.target.value })}>{grooves.map((groove) => <option key={groove}>{groove}</option>)}</select></label>
            <label><span>Set role</span><select value={form.role} onChange={(event) => patch({ role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
            <label className="research-range"><span>Energy <b>{Math.round(form.energy * 100)}</b></span><input type="range" min="0" max="1" step="0.01" value={form.energy} onChange={(event) => patch({ energy: Number(event.target.value) })} /></label>
            <label className="research-range"><span>Vocal presence <b>{Math.round(form.vocal * 100)}</b></span><input type="range" min="0" max="1" step="0.01" value={form.vocal} onChange={(event) => patch({ vocal: Number(event.target.value) })} /></label>
          </fieldset>
          <fieldset className="evidence-fields">
            <legend>Evidence & confidence</legend>
            <label><span>Provenance</span><textarea required placeholder="Manual audio review + source URL(s)" value={form.source} onChange={(event) => patch({ source: event.target.value })} /></label>
            <label className="research-range"><span>Confidence <b>{Math.round(form.confidence * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.01" value={form.confidence} onChange={(event) => patch({ confidence: Number(event.target.value) })} /></label>
          </fieldset>
          <button className="review-save" type="submit" disabled={busy}><Save size={15} /> Save reviewed features</button>
        </form>
        <div className="review-policy"><Check size={13} /> Saving clears “needs review” and records seven timestamped observations. Source playlists are never changed.</div>
      </section>
    </div>
  )
}

function blank(track?: Track): TrackEnrichment {
  return {
    trackId: track?.id ?? '', bpm: track?.bpm ?? 0, musicalKey: track?.musicalKey ?? '', camelot: track?.camelot ?? '',
    energy: track?.energy || 0.5, groove: track?.groove || grooves[0], vocal: track?.vocal || 0.1,
    role: track?.role || roles[1], source: track?.featureProvenance === 'spotify-library-sync' ? '' : (track?.featureProvenance ?? ''), confidence: track?.featureConfidence || 0.85,
  }
}
