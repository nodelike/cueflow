import type { Bootstrap, GenerateRequest, PublishedPlaylist, SetDraft, SpotifyPlaylist, TidalCapabilityReport, TidalPreviewBatch, TidalSavedSet, TidalStatus, Track, TrackEnrichment, TrackWaveform, TransitionFeedback, TransitionVerdict } from './types'

const API_ROOT = import.meta.env.VITE_CUEFLOW_API_URL ?? 'http://127.0.0.1:8787'

async function json<T>(response: Response): Promise<T> {
  const value = await response.json()
  if (!response.ok) throw new Error(value.error ?? `Cueflow request failed (${response.status})`)
  return value as T
}

function desktop() {
  return window.go?.main?.App
}

export async function bootstrap(): Promise<Bootstrap> {
  if (desktop()) return desktop()!.Bootstrap()
  return json<Bootstrap>(await fetch(`${API_ROOT}/api/bootstrap`))
}

export async function seedReferenceCatalog(): Promise<Bootstrap> {
  if (desktop()) return desktop()!.SeedReferenceCatalog()
  return json<Bootstrap>(await fetch(`${API_ROOT}/api/seed`, { method: 'POST' }))
}

export async function generateSets(request: GenerateRequest): Promise<SetDraft[]> {
  if (desktop()) return desktop()!.GenerateSets(request)
  return json<SetDraft[]>(await fetch(`${API_ROOT}/api/sets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }))
}

export async function spotifyConnected(): Promise<boolean> {
  if (desktop()) return desktop()!.SpotifyConnected()
  const result = await json<{ connected: boolean }>(await fetch(`${API_ROOT}/api/spotify/status`))
  return result.connected
}

export async function connectSpotify(): Promise<void> {
  if (desktop()) return desktop()!.ConnectSpotify()
  throw new Error('Spotify connection is available in the Cueflow desktop app')
}

export async function tidalStatus(): Promise<TidalStatus> {
  if (desktop()) return desktop()!.TidalStatus()
  return json<TidalStatus>(await fetch(`${API_ROOT}/api/tidal/status`))
}

export async function connectTidal(): Promise<void> {
  if (desktop()) return desktop()!.ConnectTidal()
  throw new Error('TIDAL connection is available in the Cueflow desktop app')
}

export async function probeTidalCapabilities(trackId = ''): Promise<TidalCapabilityReport> {
  if (desktop()) return desktop()!.ProbeTidalCapabilities(trackId)
  return json<TidalCapabilityReport>(await fetch(`${API_ROOT}/api/tidal/capabilities/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId }),
  }))
}

export async function publishTidalPreviews(draftIds: string[]): Promise<TidalPreviewBatch> {
  if (desktop()) return desktop()!.PublishTidalPreviews(draftIds)
  return json<TidalPreviewBatch>(await fetch(`${API_ROOT}/api/tidal/previews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftIds }),
  }))
}

export async function tidalSavedSets(): Promise<TidalSavedSet[]> {
  if (desktop()) return desktop()!.TidalSavedSets()
  return json<TidalSavedSet[]>(await fetch(`${API_ROOT}/api/tidal/sets`))
}

export async function saveTidalSet(draftId: string): Promise<TidalSavedSet> {
  if (desktop()) return desktop()!.SaveTidalSet(draftId)
  return json<TidalSavedSet>(await fetch(`${API_ROOT}/api/tidal/sets/${encodeURIComponent(draftId)}`, { method: 'POST' }))
}

export async function spotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  if (desktop()) return desktop()!.SpotifyPlaylists()
  return json<SpotifyPlaylist[]>(await fetch(`${API_ROOT}/api/spotify/playlists`))
}

export async function syncSpotifyPlaylists(playlistIds: string[]): Promise<Bootstrap> {
  if (desktop()) return desktop()!.SyncSpotifyPlaylists(playlistIds)
  return json<Bootstrap>(await fetch(`${API_ROOT}/api/spotify/playlists/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlistIds }),
  }))
}

export async function publishSet(draftId: string): Promise<PublishedPlaylist> {
  if (desktop()) return desktop()!.PublishSet(draftId)
  return json<PublishedPlaylist>(await fetch(`${API_ROOT}/api/sets/${draftId}/publish`, { method: 'POST' }))
}

export async function needsReview(): Promise<Track[]> {
  if (desktop()) return desktop()!.NeedsReview()
  return json<Track[]>(await fetch(`${API_ROOT}/api/research/queue`))
}

export async function enrichTrack(input: TrackEnrichment): Promise<void> {
  if (desktop()) return desktop()!.EnrichTrack(input)
  const response = await fetch(`${API_ROOT}/api/tracks/${encodeURIComponent(input.trackId)}/enrichment`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const value = await response.json()
    throw new Error(value.error ?? `Cueflow request failed (${response.status})`)
  }
}

export async function trackWaveform(trackId: string): Promise<TrackWaveform> {
  if (desktop()) return desktop()!.TrackWaveform(trackId)
  return json<TrackWaveform>(await fetch(`${API_ROOT}/api/tracks/${encodeURIComponent(trackId)}/waveform`))
}

export async function saveTransitionFeedback(fromTrackId: string, toTrackId: string, verdict: TransitionVerdict): Promise<TransitionFeedback> {
  const feedback = { fromTrackId, toTrackId, verdict, recordedAt: new Date().toISOString() }
  if (desktop()) return desktop()!.SaveTransitionFeedback(feedback)
  return json<TransitionFeedback>(await fetch(`${API_ROOT}/api/transitions/${encodeURIComponent(fromTrackId)}/to/${encodeURIComponent(toTrackId)}/feedback`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict }),
  }))
}
