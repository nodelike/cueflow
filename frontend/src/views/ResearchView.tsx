import { Check, ExternalLink, Headphones, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { padPosition } from '../lib/format'
import type { Track, TrackEnrichment } from '../types'
import { Artwork } from '../components/common/Artwork'
import { Select } from '../components/common/Select'
import { SectionHeader } from '../components/shell/SectionHeader'

type Props = {
  tracks: Track[]
  busy: boolean
  onSave: (input: TrackEnrichment) => Promise<void>
}

const grooves = ['afro', 'tribal', 'house', 'tech-house', 'techno']
const roles = ['opener', 'builder', 'bridge', 'lifter', 'peak', 'reset', 'vocal', 'closer']
const options = (values: string[]) => values.map((value) => ({ value, label: value }))

/** Verify BPM, key, feel, and role by ear before a track can enter generation. */
export function ResearchView({ tracks, busy, onSave }: Props) {
  const [selectedID, setSelectedID] = useState(tracks[0]?.id ?? '')
  const selected = tracks.find((track) => track.id === selectedID) ?? tracks[0]
  const [form, setForm] = useState<TrackEnrichment>(() => blank(selected))

  useEffect(() => {
    const next = tracks.find((track) => track.id === selectedID) ?? tracks[0]
    if (next && next.id !== selectedID) setSelectedID(next.id)
    setForm(blank(next))
  }, [selectedID, tracks])

  const patch = (value: Partial<TrackEnrichment>) => setForm((current) => ({ ...current, ...value }))

  return (
    <div className="section">
      <SectionHeader
        title="Research"
        subtitle={selected
          ? `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} waiting for human ears · verified features unlock generation`
          : 'Every synced track has verified features.'}
      />

      <div className="section-body research">
        {!selected ? (
          <div className="empty">
            <ShieldCheck size={30} />
            <h2>Research queue clear</h2>
            <p>New Spotify arrivals land here until BPM, key, feel, role, and evidence are verified by ear.</p>
          </div>
        ) : (
          <>
            <aside className="queue scroll" aria-label="Research queue">
              {tracks.map((track, index) => (
                <button
                  type="button"
                  key={track.id}
                  className={`queue-item${track.id === selected.id ? ' selected' : ''}`}
                  onClick={() => setSelectedID(track.id)}
                >
                  <span className="num muted">{padPosition(index + 1)}</span>
                  <Artwork track={track} size={34} />
                  <span className="queue-name">
                    <strong className="truncate">{track.title}</strong>
                    <small className="truncate">{track.artist}</small>
                  </span>
                  <em className="truncate">{track.sourcePlaylist}</em>
                </button>
              ))}
            </aside>

            <section className="dossier scroll">
              <header className="dossier-head">
                <div className="dossier-track">
                  <Artwork track={selected} size={56} linked />
                  <div>
                    <span className="eyebrow">Track dossier</span>
                    <h2 className="truncate">{selected.title}</h2>
                    <p className="truncate">{selected.artist} · {selected.sourcePlaylist}</p>
                  </div>
                </div>
                {selected.spotifyId && (
                  <a className="btn" href={`https://open.spotify.com/track/${selected.spotifyId}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open in Spotify
                  </a>
                )}
              </header>

              <div className="listening-note">
                <Headphones size={17} />
                <div>
                  <strong>Listen beyond the store tag.</strong>
                  <span>Judge the kick and bass relationship, percussion pocket, phrase density, vocal dominance, breakdown length, and where this record works in an arc.</span>
                </div>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void onSave(form) }}>
                <fieldset>
                  <legend>Measured identity</legend>
                  <label className="field">
                    <span>BPM</span>
                    <input required type="number" min="40" max="220" step="0.01" value={form.bpm || ''} onChange={(event) => patch({ bpm: Number(event.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Musical key</span>
                    <input required placeholder="A minor" value={form.musicalKey} onChange={(event) => patch({ musicalKey: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Camelot</span>
                    <input required pattern="(?:[1-9]|1[0-2])[ABab]" placeholder="8A" value={form.camelot} onChange={(event) => patch({ camelot: event.target.value.toUpperCase() })} />
                  </label>
                </fieldset>

                <fieldset>
                  <legend>Structural feel</legend>
                  <div className="field">
                    <span>Groove</span>
                    <Select value={form.groove} options={options(grooves)} ariaLabel="Groove" onChange={(next) => patch({ groove: next })} />
                  </div>
                  <div className="field">
                    <span>Set role</span>
                    <Select value={form.role} options={options(roles)} ariaLabel="Set role" onChange={(next) => patch({ role: next })} />
                  </div>
                  <label className="range">
                    <span>Energy <b>{Math.round(form.energy * 100)}</b></span>
                    <input type="range" min="0" max="1" step="0.01" value={form.energy} onChange={(event) => patch({ energy: Number(event.target.value) })} />
                  </label>
                  <label className="range">
                    <span>Vocal presence <b>{Math.round(form.vocal * 100)}</b></span>
                    <input type="range" min="0" max="1" step="0.01" value={form.vocal} onChange={(event) => patch({ vocal: Number(event.target.value) })} />
                  </label>
                </fieldset>

                <fieldset className="evidence">
                  <legend>Evidence & confidence</legend>
                  <label className="field">
                    <span>Provenance</span>
                    <textarea required placeholder="Manual audio review + source URL(s)" value={form.source} onChange={(event) => patch({ source: event.target.value })} />
                  </label>
                  <label className="range">
                    <span>Confidence <b>{Math.round(form.confidence * 100)}%</b></span>
                    <input type="range" min="0.1" max="1" step="0.01" value={form.confidence} onChange={(event) => patch({ confidence: Number(event.target.value) })} />
                  </label>
                </fieldset>

                <div className="dossier-actions">
                  <button className="btn primary lg" type="submit" disabled={busy}>
                    {busy ? <span className="spinner" /> : <Save size={15} />} Save reviewed features
                  </button>
                  <p><Check size={13} /> Saving clears “needs review” and records seven timestamped observations. Source playlists are never changed.</p>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function blank(track?: Track): TrackEnrichment {
  return {
    trackId: track?.id ?? '',
    bpm: track?.bpm ?? 0,
    musicalKey: track?.musicalKey ?? '',
    camelot: track?.camelot ?? '',
    energy: track?.energy || 0.5,
    groove: track?.groove || grooves[0],
    vocal: track?.vocal || 0.1,
    role: track?.role || roles[1],
    source: track?.featureProvenance === 'spotify-library-sync' ? '' : (track?.featureProvenance ?? ''),
    confidence: track?.featureConfidence || 0.85,
  }
}
