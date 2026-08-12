import type { Bootstrap, GenerateRequest, PublishedPlaylist, SetDraft, SpotifyPlaylist, Track, TrackEnrichment, TrackWaveform } from './types'

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
