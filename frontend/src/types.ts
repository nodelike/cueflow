/** Top-level workspaces. One job each, reachable with ⌘1–⌘4. */
export type Section = 'studio' | 'library' | 'sources' | 'research'

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

export type WaveformPoint = {
  startSeconds: number
  endSeconds: number
  rms: number
  peak: number
}

export type TrackWaveform = {
  trackId: string
  durationSeconds: number
  analyzerVersion?: string
  waveform: WaveformPoint[]
}

export type ScoreComponent = { name: string; score: number; note: string }

export type AutomationPoint = { bar: number; value: number }
export type AutomationLane = { target: string; points: AutomationPoint[] }

export type TransitionPlan = {
  version: string
  fromCueId: string
  toCueId: string
  style: string
  bars: number
  fromStartSeconds: number
  fromEndSeconds: number
  toStartSeconds: number
  toEndSeconds: number
  tempoAdjustmentPct: number
  bassSwapBar: number
  score: number
  risk: 'low' | 'medium' | 'high'
  confidence: number
  components: ScoreComponent[]
  automation: AutomationLane[]
  notes: string[]
  renderValidationRequired: boolean
}

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
  plan?: TransitionPlan
}

export type TransitionVerdict = 'compatible' | 'incompatible'

export type TransitionFeedback = {
  fromTrackId: string
  toTrackId: string
  verdict: TransitionVerdict
  recordedAt: string
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
  temporalCoverage: number
  temporalConfidence: number
  createdAt: string
  tracks: SetTrack[]
}

/** A permanent playlist mirrored read-only into the master library. */
export type SourcePlaylist = {
  id: string
  name: string
  kind: string
  imageUrl?: string
  trackCount: number
  syncedAt: string
}

export type Bootstrap = {
  databaseReady: boolean
  trackCount: number
  draftCount: number
  tracks: Track[]
  drafts: SetDraft[]
  syncedPlaylists: SourcePlaylist[]
  transitionFeedback: TransitionFeedback[]
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
          TidalStatus: () => Promise<TidalStatus>
          ConnectTidal: () => Promise<void>
          ProbeTidalCapabilities: (trackId: string) => Promise<TidalCapabilityReport>
          PublishSet: (draftId: string) => Promise<PublishedPlaylist>
          NeedsReview: () => Promise<Track[]>
          EnrichTrack: (input: TrackEnrichment) => Promise<void>
          TrackWaveform: (trackId: string) => Promise<TrackWaveform>
          SaveTransitionFeedback: (feedback: TransitionFeedback) => Promise<TransitionFeedback>
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

export type TidalStatus = {
  configured: boolean
  connected: boolean
  grantedScopes: string[]
}

export type TidalCapabilityReport = TidalStatus & {
  createPlaylist: boolean
  readPlaylist: boolean
  addPlaylistItem: boolean
  deletePlaylist: boolean
  probePlaylistId?: string
  message: string
}
