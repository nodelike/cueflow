export type Track = {
  id: string
  spotifyId?: string
  spotifyUri?: string
  title: string
  artist: string
  albumImageUrl?: string
  durationSeconds: number
  bpm: number
  musicalKey: string
  camelot: string
  energy: number
  groove: string
  vocal: number
  role: string
  sourcePlaylist: string
  sourcePlaylistIds?: string[]
  addedAt: string
  featureConfidence: number
  featureProvenance: string
  featureNeedsReview: boolean
}

export type TrackEnrichment = {
  trackId: string
  bpm: number
  musicalKey: string
  camelot: string
  energy: number
  groove: string
  vocal: number
  role: string
  source: string
  confidence: number
}

export type ScoreComponent = { name: string; score: number; note: string }

export type Transition = {
  fromTrackId: string
  toTrackId: string
  score: number
  risk: 'low' | 'medium' | 'high' | ''
  basis: 'metadata-only' | 'temporal' | 'rendered' | ''
  tempoAdjustmentPct: number
  tempoOctaveEquivalent: boolean
  confidence: number
  summary: string
  components: ScoreComponent[]
}

export type SetTrack = {
  position: number
  track: Track
  targetEnergy: number
  transition: Transition
}

export type SetDraft = {
  id: string
  sessionId: string
  name: string
  variation: number
  arc: string
  durationSeconds: number
  durationBasis: string
  qualityScore: number
  scoreVersion: string
  energyFit: number
  harmonicFlow: number
  tempoFlow: number
  diversity: number
  transitionSafety: number
  weakestTransition: number
  highRiskTransitions: number
  analysisConfidence: number
  createdAt: string
  tracks: SetTrack[]
}

export type Bootstrap = {
  databaseReady: boolean
  trackCount: number
  draftCount: number
  tracks: Track[]
  drafts: SetDraft[]
  error?: string
}

export type GenerateRequest = {
  name: string
  durationMinutes: number
  variationCount: number
  arc: string
  harmonicStrictness: number
  exploration: number
  startBpm: number
  endBpm: number
  allowedGrooves: string[]
  sourcePlaylistIds: string[]
  requiredTrackIds: string[]
  excludedTrackIds: string[]
  seed: number
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          Bootstrap: () => Promise<Bootstrap>
          SeedReferenceCatalog: () => Promise<Bootstrap>
          GenerateSets: (request: GenerateRequest) => Promise<SetDraft[]>
          SpotifyConnected: () => Promise<boolean>
          SpotifyPlaylists: () => Promise<SpotifyPlaylist[]>
          SyncSpotifyPlaylists: (playlistIds: string[]) => Promise<Bootstrap>
          ConnectSpotify: () => Promise<void>
          PublishSet: (draftId: string) => Promise<PublishedPlaylist>
          NeedsReview: () => Promise<Track[]>
          EnrichTrack: (input: TrackEnrichment) => Promise<void>
        }
      }
    }
  }
}

export type PublishedPlaylist = { ID: string; Name: string; Kind: string; Writable: boolean }

export type SpotifyPlaylist = {
  ID: string
  Name: string
  Kind: string
  Writable: boolean
  ImageURL: string
  TrackCount: number
  Synced: boolean
}
