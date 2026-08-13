import { AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bootstrap, connectSpotify, connectTidal, enrichTrack, generateSets, needsReview, probeTidalCapabilities, publishSet, publishTidalPreviews, saveTransitionFeedback, spotifyConnected, spotifyPlaylists, syncSpotifyPlaylists, tidalStatus } from './api'
import { Sidebar } from './components/shell/Sidebar'
import { Toasts, type Toast } from './components/shell/Toasts'
import { transitionKey } from './components/studio/MixSheet'
import { getSavedRequiredTrackIDs, getSavedSection, getSavedSourcePlaylistIDs, saveRequiredTrackIDs, saveSection, saveSourcePlaylistIDs } from './lib/preferences'
import { getInitialTheme, saveTheme, type Theme } from './lib/theme'
import type { Bootstrap, GenerateRequest, Section, SetDraft, SpotifyPlaylist, TidalStatus, Track, TrackEnrichment, TransitionVerdict } from './types'
import { LibraryView } from './views/LibraryView'
import { ResearchView } from './views/ResearchView'
import { SourcesView } from './views/SourcesView'
import { StudioView } from './views/StudioView'
import './App.css'

const initialRequest: GenerateRequest = {
  name: 'Afro to pressure', durationMinutes: 60, variationCount: 3, arc: 'journey',
  harmonicStrictness: 0.76, exploration: 0.34, startBpm: 118, endBpm: 130,
  allowedGrooves: [], sourcePlaylistIds: [], requiredTrackIds: [], excludedTrackIds: [], seed: 9127,
}

const sectionOrder: Section[] = ['studio', 'library', 'sources', 'research']

function App() {
  const [data, setData] = useState<Bootstrap>()
  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const [selectedDraft, setSelectedDraft] = useState(0)
  const [selectedPosition, setSelectedPosition] = useState(1)
  const [request, setRequest] = useState<GenerateRequest>(() => ({
    ...initialRequest,
    requiredTrackIds: getSavedRequiredTrackIDs(),
    sourcePlaylistIds: getSavedSourcePlaylistIDs(),
  }))
  const [section, setSection] = useState<Section>(getSavedSection)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [spotifyReady, setSpotifyReady] = useState(false)
  const [tidal, setTidal] = useState<TidalStatus>({ configured: false, connected: false, grantedScopes: [] })
  const [researchQueue, setResearchQueue] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [syncing, setSyncing] = useState<string[]>([])
  const [savingTransition, setSavingTransition] = useState('')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const toastID = useRef(0)

  useEffect(() => { void load() }, [])
  useEffect(() => { saveTheme(theme) }, [theme])
  useEffect(() => { saveSection(section) }, [section])
  useEffect(() => { saveRequiredTrackIDs(request.requiredTrackIds) }, [request.requiredTrackIds])
  useEffect(() => { saveSourcePlaylistIDs(request.sourcePlaylistIds) }, [request.sourcePlaylistIds])

  const notify = useCallback((message: string) => {
    const id = ++toastID.current
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
  }, [])

  // Failures stay on screen until dismissed; only successes are transient.
  function report(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught))
  }

  async function load() {
    try {
      const [result, connected, tidalConnection, queue] = await Promise.all([bootstrap(), spotifyConnected(), tidalStatus(), needsReview()])
      if (result.error) throw new Error(result.error)
      setData(result)
      setDrafts(result.drafts)
      setSpotifyReady(connected)
      setTidal(tidalConnection)
      setResearchQueue(queue)
      setError('')
      if (connected) setPlaylists(await spotifyPlaylists())
    } catch (caught) {
      report(caught)
    }
  }

  // ⌘1–⌘4 move between workspaces the way a native app does.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) return
      const index = Number.parseInt(event.key, 10) - 1
      if (Number.isNaN(index) || index < 0 || index >= sectionOrder.length) return
      event.preventDefault()
      setSection(sectionOrder[index])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function generate() {
    setBusy(true)
    setError('')
    try {
      const result = await generateSets(request)
      setDrafts(result)
      setSelectedDraft(0)
      setSelectedPosition(1)
      setSection('studio')
      setData((current) => current ? { ...current, draftCount: current.draftCount + result.length, drafts: result } : current)
      notify(`${result.length} variations ready`)
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    const draft = drafts[selectedDraft]
    if (!draft) return
    setBusy(true)
    try {
      const playlist = await publishSet(draft.id)
      notify(`Published ${playlist.Name}`)
      if (spotifyReady) setPlaylists(await spotifyPlaylists())
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function previewInTidal() {
    if (drafts.length === 0) return
    setBusy(true)
    setError('')
    try {
      const result = await publishTidalPreviews(drafts.map((draft) => draft.id))
      const warning = result.warnings.length > 0 ? ` · ${result.warnings.length} cleanup warning` : ''
      notify(`${result.playlists.length} TIDAL variations ready in djay Pro${warning}`)
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    setBusy(true)
    try {
      await connectSpotify()
      setSpotifyReady(true)
      setPlaylists(await spotifyPlaylists())
      notify('Spotify connected')
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function connectToTidal() {
    setBusy(true)
    setError('')
    try {
      await connectTidal()
      const connection = await tidalStatus()
      setTidal(connection)
      notify('TIDAL connected')
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function probeTidal() {
    setBusy(true)
    setError('')
    try {
      const report = await probeTidalCapabilities()
      notify(report.message)
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function sync(playlistIDs: string[]) {
    if (playlistIDs.length === 0) return
    setSyncing(playlistIDs)
    setBusy(true)
    try {
      const result = await syncSpotifyPlaylists(playlistIDs)
      setData(result)
      setDrafts(result.drafts)
      setPlaylists(await spotifyPlaylists())
      setResearchQueue(await needsReview())
      notify(playlistIDs.length === 1 ? 'Crate synced into the library' : `${playlistIDs.length} crates synced`)
    } catch (caught) {
      report(caught)
    } finally {
      setSyncing([])
      setBusy(false)
    }
  }

  async function saveEnrichment(input: TrackEnrichment) {
    setBusy(true)
    try {
      await enrichTrack(input)
      const [result, queue] = await Promise.all([bootstrap(), needsReview()])
      setData(result)
      setResearchQueue(queue)
      notify('Features verified')
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  async function recordTransition(fromTrackId: string, toTrackId: string, verdict: TransitionVerdict) {
    const key = transitionKey(fromTrackId, toTrackId)
    const previous = data?.transitionFeedback ?? []
    const optimistic = { fromTrackId, toTrackId, verdict, recordedAt: new Date().toISOString() }
    const replace = (list: typeof previous) => [optimistic, ...list.filter((item) => item.fromTrackId !== fromTrackId || item.toTrackId !== toTrackId)]
    setSavingTransition(key)
    setData((current) => current ? { ...current, transitionFeedback: replace(current.transitionFeedback ?? []) } : current)
    try {
      const saved = await saveTransitionFeedback(fromTrackId, toTrackId, verdict)
      setData((current) => current
        ? { ...current, transitionFeedback: [saved, ...(current.transitionFeedback ?? []).filter((item) => item.fromTrackId !== fromTrackId || item.toTrackId !== toTrackId)] }
        : current)
    } catch (caught) {
      setData((current) => current ? { ...current, transitionFeedback: previous } : current)
      report(caught)
    } finally {
      setSavingTransition('')
    }
  }

  const tracks = data?.tracks ?? []
  const crates = data?.syncedPlaylists ?? []
  const feedback = useMemo(
    () => new Map((data?.transitionFeedback ?? []).map((item) => [transitionKey(item.fromTrackId, item.toTrackId), item])),
    [data?.transitionFeedback],
  )
  const eligibleCount = request.sourcePlaylistIds.length === 0
    ? tracks.length
    : tracks.filter((track) => track.sourcePlaylistIds?.some((id) => request.sourcePlaylistIds.includes(id))).length

  return (
    <div className="app">
      <Sidebar
        section={section}
        trackCount={data?.trackCount ?? 0}
        crateCount={crates.length}
        researchCount={researchQueue.length}
        spotifyReady={spotifyReady}
        busy={busy}
        theme={theme}
        onNavigate={setSection}
        onConnect={() => void connect()}
        onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
        onRefresh={() => void load()}
      />

      {section === 'studio' && (
        <StudioView
          drafts={drafts}
          selectedDraft={selectedDraft}
          selectedPosition={selectedPosition}
          request={request}
          tracks={tracks}
          crates={crates}
          eligibleCount={eligibleCount}
          feedback={feedback}
          savingTransition={savingTransition}
          spotifyReady={spotifyReady}
          tidalReady={tidal.connected}
          busy={busy}
          onRequestChange={setRequest}
          onGenerate={() => void generate()}
          onPublish={() => void publish()}
          onPreviewTidal={() => void previewInTidal()}
          onSelectDraft={(index) => { setSelectedDraft(index); setSelectedPosition(1) }}
          onSelectPosition={setSelectedPosition}
          onFeedback={(fromTrackId, toTrackId, verdict) => void recordTransition(fromTrackId, toTrackId, verdict)}
          onNavigate={setSection}
        />
      )}
      {section === 'library' && <LibraryView tracks={tracks} crates={crates} onNavigate={setSection} />}
      {section === 'sources' && (
        <SourcesView
          playlists={playlists}
          crates={crates}
          tracks={tracks}
          spotifyReady={spotifyReady}
          tidal={tidal}
          busy={busy}
          syncing={syncing}
          onSync={(ids) => void sync(ids)}
          onConnect={() => void connect()}
          onConnectTidal={() => void connectToTidal()}
          onProbeTidal={() => void probeTidal()}
        />
      )}
      {section === 'research' && <ResearchView tracks={researchQueue} busy={busy} onSave={saveEnrichment} />}

      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" className="btn sm ghost" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      <Toasts toasts={toasts} />
    </div>
  )
}

export default App
