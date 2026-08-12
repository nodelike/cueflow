import { AlertCircle, Check, Disc3, Link2, Moon, RefreshCw, Send, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { bootstrap, connectSpotify, enrichTrack, generateSets, needsReview, publishSet, spotifyConnected, spotifyPlaylists, syncSpotifyPlaylists } from './api'
import { GeneratorPanel } from './components/GeneratorPanel'
import { CamelotKey } from './components/CamelotKey'
import { MixRibbon } from './components/MixRibbon'
import { ResearchDesk } from './components/ResearchDesk'
import { SetInspector } from './components/SetInspector'
import { TrackArtwork } from './components/TrackArtwork'
import { formatDate, formatDuration } from './lib/format'
import { getSavedRequiredTrackIDs, getSavedSourcePlaylistIDs, saveRequiredTrackIDs, saveSourcePlaylistIDs } from './lib/preferences'
import { getInitialTheme, saveTheme, type Theme } from './lib/theme'
import type { Bootstrap, GenerateRequest, SetDraft, SpotifyPlaylist, Track, TrackEnrichment } from './types'
import './App.css'

const initialRequest: GenerateRequest = {
  name: 'Afro to pressure', durationMinutes: 60, variationCount: 3, arc: 'journey',
  harmonicStrictness: 0.76, exploration: 0.34, startBpm: 118, endBpm: 130,
  allowedGrooves: [], sourcePlaylistIds: [], requiredTrackIds: [], excludedTrackIds: [], seed: 9127,
}

function App() {
  const [data, setData] = useState<Bootstrap>()
  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const [selectedDraft, setSelectedDraft] = useState(0)
  const [selectedPosition, setSelectedPosition] = useState(1)
  const [request, setRequest] = useState<GenerateRequest>(() => ({ ...initialRequest, requiredTrackIds: getSavedRequiredTrackIDs(), sourcePlaylistIds: getSavedSourcePlaylistIDs() }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [spotifyReady, setSpotifyReady] = useState(false)
  const [published, setPublished] = useState('')
  const [view, setView] = useState<'builder' | 'research'>('builder')
  const [researchQueue, setResearchQueue] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => { void load() }, [])
  useEffect(() => { saveTheme(theme) }, [theme])
  useEffect(() => { saveRequiredTrackIDs(request.requiredTrackIds) }, [request.requiredTrackIds])
  useEffect(() => { saveSourcePlaylistIDs(request.sourcePlaylistIds) }, [request.sourcePlaylistIds])

  async function load() {
    try {
      const [result, connected, queue] = await Promise.all([bootstrap(), spotifyConnected(), needsReview()])
      if (result.error) throw new Error(result.error)
      setData(result); setDrafts(result.drafts); setSpotifyReady(connected); setResearchQueue(queue)
      if (connected) setPlaylists(await spotifyPlaylists())
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

  async function generate() {
    setBusy(true); setError(''); setPublished('')
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
    try { await connectSpotify(); setSpotifyReady(true); setPlaylists(await spotifyPlaylists()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { setBusy(false) }
  }

  async function syncSources(playlistIDs: string[]) {
    setBusy(true); setError('')
    try {
      const result = await syncSpotifyPlaylists(playlistIDs)
      setData(result); setDrafts(result.drafts); setRequest((current) => ({ ...current, sourcePlaylistIds: playlistIDs }))
      setPlaylists(await spotifyPlaylists())
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); throw caught }
    finally { setBusy(false) }
  }

  const activeDraft = drafts[selectedDraft]
  const activeTrack = activeDraft?.tracks.find((item) => item.position === selectedPosition) ?? activeDraft?.tracks[0]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><Disc3 size={19} /><strong>Cueflow</strong></div>
        <nav aria-label="Primary"><button className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>Set builder</button><button className={view === 'research' ? 'active' : ''} onClick={() => setView('research')}>Research {researchQueue.length > 0 && <span>{researchQueue.length}</span>}</button></nav>
        <div className="app-status"><span className={data?.databaseReady ? 'ready' : ''}>{data?.trackCount ?? '—'} tracks</span><button type="button" disabled={busy || spotifyReady} onClick={() => void connect()}><Link2 size={13} /> {spotifyReady ? 'Spotify connected' : 'Connect Spotify'}</button><button type="button" className="icon-button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><button type="button" className="icon-button" onClick={() => void load()} aria-label="Refresh"><RefreshCw size={15} /></button></div>
      </header>

      {error && <div className="error-banner"><AlertCircle size={17} /><span>{error}</span></div>}

      {view === 'research' ? <main className="research-page"><ResearchDesk tracks={researchQueue} busy={busy} onSave={saveEnrichment} /></main> :
        <main className="builder-layout">
          <GeneratorPanel value={request} tracks={data?.tracks ?? []} playlists={playlists} spotifyReady={spotifyReady} busy={busy} onChange={setRequest} onSyncSources={syncSources} onGenerate={() => void generate()} />
          <section className="set-canvas">
            {!activeDraft ? <div className="empty-set"><Disc3 size={28} /><h2>No set yet</h2><p>Choose your constraints, add any must-play tracks, then generate a few directions.</p></div> : <>
              <header className="set-header">
                <div><span>{activeDraft.arc} · {formatDuration(activeDraft.durationSeconds)} · {activeDraft.tracks.length} tracks</span><h1>{activeDraft.name}</h1><p>Generated {formatDate(activeDraft.createdAt)}</p></div>
                <div className="set-actions"><div className="quality"><strong>{activeDraft.qualityScore}</strong><span>quality</span></div><button type="button" disabled={!spotifyReady || busy} onClick={() => void publish()}><Send size={14} /> Publish</button></div>
              </header>

              {published && <div className="publish-success"><Check size={14} /> Published {published}</div>}

              <div className="variation-bar" role="tablist" aria-label="Set variations">{drafts.map((draft, index) => <button type="button" role="tab" aria-selected={selectedDraft === index} className={selectedDraft === index ? 'active' : ''} key={draft.id} onClick={() => { setSelectedDraft(index); setSelectedPosition(1) }}><span>{String.fromCharCode(65 + index)}</span>{draft.qualityScore}</button>)}</div>

              <div className="score-summary"><span>Energy <b>{Math.round(activeDraft.energyFit)}</b></span><span>Harmony <b>{Math.round(activeDraft.harmonicFlow)}</b></span><span>Tempo <b>{Math.round(activeDraft.tempoFlow)}</b></span><span>Variety <b>{Math.round(activeDraft.diversity)}</b></span></div>

              <MixRibbon draft={activeDraft} selectedPosition={selectedPosition} onSelect={setSelectedPosition} />

              <div className="set-body">
                <div className="track-ledger" aria-label="Set track list">
                  <div className="ledger-head"><span>#</span><span /><span>Track</span><span>BPM</span><span>Key</span><span>Energy</span></div>
                  {activeDraft.tracks.map((item) => <button type="button" key={item.track.id} className={item.position === selectedPosition ? 'selected' : ''} onClick={() => setSelectedPosition(item.position)} aria-label={`${item.position}. ${item.track.title} by ${item.track.artist}`}>
                    <span>{String(item.position).padStart(2, '0')}</span><TrackArtwork track={item.track} /><span><strong>{item.track.title}</strong><small>{item.track.artist}</small></span><b>{item.track.bpm}</b><CamelotKey value={item.track.camelot} compact /><i><span style={{ width: `${item.track.energy * 100}%` }} /></i>
                  </button>)}
                </div>
                <SetInspector item={activeTrack} />
              </div>
            </>}
          </section>
        </main>}
    </div>
  )
}

export default App
