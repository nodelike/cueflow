import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Check, Database, Disc3, History, Library, Link2, RadioTower, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { bootstrap, connectSpotify, enrichTrack, generateSets, needsReview, publishSet, seedReferenceCatalog, spotifyConnected } from './api'
import { GeneratorPanel } from './components/GeneratorPanel'
import { MixRibbon } from './components/MixRibbon'
import { SetInspector } from './components/SetInspector'
import { ResearchDesk } from './components/ResearchDesk'
import { formatDate, formatDuration } from './lib/format'
import type { Bootstrap, GenerateRequest, SetDraft, Track, TrackEnrichment } from './types'
import './App.css'

const initialRequest: GenerateRequest = {
  name: 'Afro to pressure', durationMinutes: 60, variationCount: 3, arc: 'journey',
  harmonicStrictness: 0.76, exploration: 0.34, startBpm: 118, endBpm: 130,
  allowedGrooves: [], requiredTrackIds: [], excludedTrackIds: [], seed: 9127,
}

function App() {
  const [data, setData] = useState<Bootstrap>()
  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const [selectedDraft, setSelectedDraft] = useState(0)
  const [selectedPosition, setSelectedPosition] = useState(1)
  const [request, setRequest] = useState(initialRequest)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [spotifyReady, setSpotifyReady] = useState(false)
  const [published, setPublished] = useState('')
  const [view, setView] = useState<'desk' | 'catalog'>('desk')
  const [researchQueue, setResearchQueue] = useState<Track[]>([])

  useEffect(() => { void load() }, [])

  async function load() {
    try {
      const [result, connected, queue] = await Promise.all([bootstrap(), spotifyConnected(), needsReview()])
      if (result.error) throw new Error(result.error)
      setData(result)
      setDrafts(result.drafts)
      setSpotifyReady(connected)
      setResearchQueue(queue)
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
  }

  async function saveEnrichment(input: TrackEnrichment) {
    setBusy(true); setError('')
    try {
      await enrichTrack(input)
      const [result, queue] = await Promise.all([bootstrap(), needsReview()])
      setData(result); setResearchQueue(queue)
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  async function seed() {
    setBusy(true); setError('')
    try { setData(await seedReferenceCatalog()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  async function generate() {
    setBusy(true); setError('')
    try {
      const result = await generateSets(request)
      setDrafts(result); setSelectedDraft(0); setSelectedPosition(1)
      setData((current) => current ? { ...current, draftCount: current.draftCount + result.length, drafts: result } : current)
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  async function publish() {
    if (!activeDraft) return
    setBusy(true); setError(''); setPublished('')
    try { const playlist = await publishSet(activeDraft.id); setPublished(playlist.Name) }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  async function connect() {
    setBusy(true); setError('')
    try { await connectSpotify(); setSpotifyReady(true) }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  const activeDraft = drafts[selectedDraft]
  const activeTrack = activeDraft?.tracks.find((item) => item.position === selectedPosition) ?? activeDraft?.tracks[0]
  const sources = useMemo(() => new Set(data?.tracks.map((track) => track.sourcePlaylist) ?? []).size, [data])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Disc3 size={20} /></span><div><strong>CUEFLOW</strong><small>SET LAB</small></div></div>
        <nav aria-label="Primary"><button className={view === 'desk' ? 'active' : ''} onClick={() => setView('desk')}><RadioTower size={15} /> Set desk</button><button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><Library size={15} /> Research <i>{researchQueue.length}</i></button><button onClick={() => setView('desk')}><History size={15} /> Sessions</button></nav>
        <div className="system-status"><span className={data?.databaseReady ? 'ready' : ''}><Database size={14} /> PostgreSQL</span><button type="button" className={`spotify-link ${spotifyReady ? 'ready' : ''}`} disabled={busy || spotifyReady} onClick={() => void connect()}><Link2 size={13} /> {spotifyReady ? 'Spotify linked' : 'Connect Spotify'}</button><button type="button" onClick={() => void load()} aria-label="Refresh"><RefreshCw size={15} /></button></div>
      </header>

      {view === 'catalog' ? (
        <main className="catalog-main">
          {error && <div className="error-banner"><TriangleAlert size={18} /><div><strong>Cueflow cannot continue</strong><span>{error}</span></div></div>}
          <ResearchDesk tracks={researchQueue} busy={busy} onSave={saveEnrichment} />
        </main>
      ) : <main>
        <section className="brief-column">
          <div className="page-intro"><span className="eyebrow">LIVE WORKBENCH</span><h1>Find the sequence<br /><em>that moves.</em></h1><p>Explore combinations by feel, then inspect why every transition holds—or where it needs technique.</p></div>
          <GeneratorPanel value={request} busy={busy} onChange={setRequest} onGenerate={() => void generate()} />
        </section>

        <section className="set-stage">
          <div className="library-strip">
            <div><span>CATALOG</span><strong>{data?.trackCount ?? '—'}</strong><small>tracks ready</small></div>
            <div><span>CRATES</span><strong>{sources || '—'}</strong><small>source playlists</small></div>
            <div><span>DRAFTS</span><strong>{data?.draftCount ?? '—'}</strong><small>saved variations</small></div>
            <div className="safe-badge"><Check size={14} /><span>Sources locked</span></div>
          </div>

          {error && <div className="error-banner"><TriangleAlert size={18} /><div><strong>Cueflow cannot continue</strong><span>{error}</span></div></div>}

          {!activeDraft ? (
            <div className="empty-stage">
              <span className="empty-groove" />
              <div><span className="eyebrow">THE DECK IS QUIET</span><h2>Generate your first set variations.</h2><p>The reference catalog gives the engine realistic BPM, key, groove, vocal, and energy combinations while Spotify synchronization is connected.</p>
                {(data?.trackCount ?? 0) === 0 && <button onClick={() => void seed()} disabled={busy}>Load reference catalog <ArrowUpRight size={16} /></button>}
              </div>
            </div>
          ) : (
            <>
              <div className="draft-header">
                <div><span className="eyebrow">CURRENT SESSION · {activeDraft.arc.toUpperCase()}</span><h2>{activeDraft.name}</h2><p>{formatDuration(activeDraft.durationSeconds)} · {activeDraft.tracks.length} tracks · generated {formatDate(activeDraft.createdAt)}</p></div>
                <div className="draft-actions">
                  <button type="button" className="publish-button" disabled={!spotifyReady || busy} onClick={() => void publish()} title={spotifyReady ? 'Publish this ordering to a new private Set Lab playlist' : 'Connect Spotify with make spotify-auth'}><Send size={14} /> Publish draft</button>
                  <div className="quality-stamp"><span>SET QUALITY</span><strong>{activeDraft.qualityScore}</strong></div>
                </div>
              </div>
              {published && <div className="publish-success"><Check size={14} /> Published {published}</div>}
              <div className="variation-tabs" role="tablist" aria-label="Set variations">
                {drafts.map((draft, index) => <button type="button" role="tab" aria-selected={selectedDraft === index} className={selectedDraft === index ? 'active' : ''} key={draft.id} onClick={() => { setSelectedDraft(index); setSelectedPosition(1) }}>
                  <b>{String.fromCharCode(65 + index)}</b><span>{draft.qualityScore}<small>quality</small></span>
                </button>)}
              </div>
              <div className="score-row">
                <Score label="Energy arc" value={activeDraft.energyFit} /><Score label="Harmonic flow" value={activeDraft.harmonicFlow} /><Score label="Tempo flow" value={activeDraft.tempoFlow} /><Score label="Variety" value={activeDraft.diversity} />
              </div>
              <MixRibbon draft={activeDraft} selectedPosition={selectedPosition} onSelect={setSelectedPosition} />
              <div className="set-list">
                {activeDraft.tracks.map((item) => <button key={item.track.id} type="button" className={item.position === selectedPosition ? 'selected' : ''} onClick={() => setSelectedPosition(item.position)}>
                  <span>{item.position.toString().padStart(2, '0')}</span><i className={`risk-dot risk-${item.transition.risk}`} /><strong>{item.track.title}</strong><small>{item.track.artist}</small><b>{item.track.bpm}</b><em>{item.track.camelot}</em>
                </button>)}
              </div>
            </>
          )}
        </section>

        <SetInspector item={activeTrack} />
      </main>}
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="score"><span>{label}</span><strong>{Math.round(value)}</strong><i><b style={{ width: `${value}%` }} /></i></div>
}

export default App
