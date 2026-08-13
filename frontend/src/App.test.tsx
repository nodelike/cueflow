import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { bootstrapData, draft } from './test/fixtures'

const bootstrap = vi.fn()
const generateSets = vi.fn()
const needsReview = vi.fn()
const enrichTrack = vi.fn()
const spotifyConnected = vi.fn()
const spotifyPlaylists = vi.fn()
const syncSpotifyPlaylists = vi.fn()
const trackWaveform = vi.fn()
const saveTransitionFeedback = vi.fn()
const tidalStatus = vi.fn()
const tidalSavedSets = vi.fn()
const publishTidalPreviews = vi.fn()
const saveTidalSet = vi.fn()
vi.mock('./api', () => ({
  bootstrap: () => bootstrap(),
  generateSets: (...args: unknown[]) => generateSets(...args),
  seedReferenceCatalog: vi.fn(),
  spotifyConnected: () => spotifyConnected(),
  spotifyPlaylists: () => spotifyPlaylists(),
  syncSpotifyPlaylists: (...args: unknown[]) => syncSpotifyPlaylists(...args),
  connectSpotify: vi.fn(),
  tidalStatus: () => tidalStatus(),
  tidalSavedSets: () => tidalSavedSets(),
  connectTidal: vi.fn(),
  probeTidalCapabilities: vi.fn(),
  publishTidalPreviews: (...args: unknown[]) => publishTidalPreviews(...args),
  saveTidalSet: (...args: unknown[]) => saveTidalSet(...args),
  publishSet: vi.fn(),
  needsReview: () => needsReview(),
  enrichTrack: (...args: unknown[]) => enrichTrack(...args),
  trackWaveform: (...args: unknown[]) => trackWaveform(...args),
  saveTransitionFeedback: (...args: unknown[]) => saveTransitionFeedback(...args),
}))

const openSection = (name: RegExp | string) => userEvent.click(screen.getByRole('button', { name }))

describe('Cueflow desk', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    bootstrap.mockResolvedValue(bootstrapData); generateSets.mockResolvedValue([draft]); needsReview.mockResolvedValue([]); enrichTrack.mockResolvedValue(undefined)
    spotifyConnected.mockResolvedValue(false); spotifyPlaylists.mockResolvedValue([]); syncSpotifyPlaylists.mockResolvedValue(bootstrapData)
    tidalStatus.mockResolvedValue({ configured: false, connected: false, grantedScopes: [] })
    tidalSavedSets.mockResolvedValue([])
    publishTidalPreviews.mockResolvedValue({ playlists: [], matchedTracks: 0, deletedPrevious: 0, warnings: [] })
    saveTidalSet.mockResolvedValue({ playlistId: 'tidal-set-a', draftId: draft.id, sessionId: draft.sessionId, variation: draft.variation, name: `Cueflow Set — ${draft.name}`, trackCount: draft.tracks.length, createdAt: '2026-08-14T12:00:00Z' })
    trackWaveform.mockImplementation((trackID: string) => Promise.resolve({
      trackId: trackID,
      durationSeconds: draft.tracks.find((item) => item.track.id === trackID)?.track.durationSeconds ?? 300,
      analyzerVersion: 'fixture/1',
      waveform: Array.from({ length: 12 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, rms: .12 + index * .015, peak: .3 + index * .025 })),
    }))
    saveTransitionFeedback.mockImplementation((fromTrackId: string, toTrackId: string, verdict: 'compatible' | 'incompatible') => Promise.resolve({ fromTrackId, toTrackId, verdict, recordedAt: '2026-08-13T12:00:00Z' }))
  })

  it('opens on the studio with the persisted set and its transition evidence', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Afro to pressure — A' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Set quality breakdown' }))
    expect(within(screen.getByRole('dialog', { name: 'Set quality breakdown' })).getByText('Harmony')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    const deck = screen.getByLabelText('Full waveform for Salt Horizon')
    expect(await within(deck).findByRole('img', { name: /Full-track peak and RMS waveform for Salt Horizon/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Planned cue windows')).toHaveTextContent(/out 04:08–04:40/i)

    await userEvent.click(within(screen.getByLabelText('Set track list')).getByRole('button', { name: /^2\. Clay Drums/ }))
    expect(await screen.findByRole('img', { name: /Full-track peak and RMS waveform for Clay Drums/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Planned cue windows')).toHaveTextContent(/in 00:00–00:32/i)

    const inspector = screen.getByLabelText('Track and transition inspector')
    expect(within(inspector).getByText(/Blend in/i)).toBeInTheDocument()
    expect(within(inspector).getByText('cue-window plan')).toBeInTheDocument()
    expect(within(inspector).getByText(/bass exchange at bar 8/i)).toBeInTheDocument()
    expect(within(inspector).getByText('adjacent Camelot movement')).toBeInTheDocument()
    expect(within(inspector).getByText(/rendered-audio validation is still required/i)).toBeInTheDocument()
  })

  it('captures a field-tested transition inline on the mix sheet and lets the verdict change', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    const link = screen.getByLabelText('Field test Salt Horizon into Clay Drums')
    expect(within(link).getByText(/16-bar long-blend · 8A → 9A/)).toBeInTheDocument()

    await userEvent.click(within(link).getByRole('button', { name: 'Mark Salt Horizon into Clay Drums compatible' }))
    await waitFor(() => expect(saveTransitionFeedback).toHaveBeenCalledWith('one', 'two', 'compatible'))
    expect(within(link).getByRole('button', { name: 'Mark Salt Horizon into Clay Drums compatible' })).toHaveAttribute('aria-pressed', 'true')
    expect(link).toHaveClass('verdict-compatible')
    expect(within(screen.getByLabelText('Track and transition inspector')).getByText('verified works')).toBeInTheDocument()

    await userEvent.click(within(link).getByRole('button', { name: 'Mark Salt Horizon into Clay Drums incompatible' }))
    await waitFor(() => expect(saveTransitionFeedback).toHaveBeenLastCalledWith('one', 'two', 'incompatible'))
    expect(within(link).getByRole('button', { name: 'Mark Salt Horizon into Clay Drums incompatible' })).toHaveAttribute('aria-pressed', 'true')
    expect(link).toHaveClass('verdict-incompatible')
  })

  it('submits the tunable set brief', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ arc: 'journey', durationMinutes: 60, variationCount: 3 }))
  })

  it('makes the djay preview-to-permanent lifecycle explicit', async () => {
    tidalStatus.mockResolvedValue({ configured: true, connected: true, grantedScopes: ['playlists.write'] })
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })

    await userEvent.click(screen.getByRole('button', { name: /Try all in djay/ }))
    await waitFor(() => expect(publishTidalPreviews).toHaveBeenCalledWith([draft.id]))

    await userEvent.click(screen.getByRole('button', { name: /Save A as set/ }))
    await waitFor(() => expect(saveTidalSet).toHaveBeenCalledWith(draft.id))
    expect(screen.getByRole('button', { name: /A saved/ })).toBeDisabled()
  })

  it('restores permanent-set status after a restart', async () => {
    tidalStatus.mockResolvedValue({ configured: true, connected: true, grantedScopes: ['playlists.write'] })
    tidalSavedSets.mockResolvedValue([{ playlistId: 'tidal-set-a', draftId: draft.id, sessionId: draft.sessionId, variation: 1, name: `Cueflow Set — ${draft.name}`, trackCount: 2, createdAt: '2026-08-14T12:00:00Z' }])
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    expect(screen.getByRole('button', { name: /A saved/ })).toBeDisabled()
  })

  it('changes the brief through the custom dropdown, by pointer and by keyboard', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })

    const length = screen.getByRole('combobox', { name: 'Set length' })
    await userEvent.click(length)
    await userEvent.click(screen.getByRole('option', { name: '45 min' }))
    expect(length).toHaveTextContent('45 min')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    const arc = screen.getByRole('combobox', { name: 'Energy arc' })
    arc.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(arc).toHaveTextContent('Roller')

    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 45, arc: 'roller' }))
  })

  it('limits generation to the crates picked in the brief', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await userEvent.click(screen.getByRole('button', { name: 'Choose crates' }))
    await userEvent.click(screen.getByRole('button', { name: 'Afro Vibezz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ sourcePlaylistIds: ['afro'] }))
    await waitFor(() => expect(window.localStorage.getItem('cueflow-source-playlist-ids')).toBe('["afro"]'))
  })

  it('pins a must-play track from the brief bar and restores it after a restart', async () => {
    const firstRun = render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tracks to must-play' }), 'Clay')
    await userEvent.click(within(screen.getByLabelText('Track search results')).getByRole('button', { name: /Clay Drums/ }))

    const strip = screen.getByLabelText('Must-play tracks')
    expect(within(strip).getByText('Clay Drums')).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem('cueflow-required-track-ids')).toBe('["two"]'))
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ requiredTrackIds: ['two'] }))

    firstRun.unmount()
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    expect(within(await screen.findByLabelText('Must-play tracks')).getByText('Clay Drums')).toBeInTheDocument()
  })

  it('pins and unpins a track from the mix sheet row itself', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    const sheet = screen.getByLabelText('Set track list')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Must-play Clay Drums' }))
    await waitFor(() => expect(window.localStorage.getItem('cueflow-required-track-ids')).toBe('["two"]'))
    expect(within(screen.getByLabelText('Must-play tracks')).getByText('Clay Drums')).toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Unpin Clay Drums' }))
    await waitFor(() => expect(window.localStorage.getItem('cueflow-required-track-ids')).toBe('[]'))
    expect(screen.queryByLabelText('Must-play tracks')).not.toBeInTheDocument()
  })

  it('matches track search without caring about case, punctuation, accents, or spacing', async () => {
    const looseMatchTrack = { ...draft.tracks[0].track, id: 'loose-match', title: "DON’T Stop", artist: 'Café Noir' }
    bootstrap.mockResolvedValue({ ...bootstrapData, tracks: [...bootstrapData.tracks, looseMatchTrack] })
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    const search = screen.getByRole('searchbox', { name: 'Search tracks to must-play' })

    await userEvent.type(search, 'dont')
    expect(within(screen.getByLabelText('Track search results')).getByRole('button', { name: /DON’T Stop/ })).toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, 'CAFE NOIR')
    expect(within(screen.getByLabelText('Track search results')).getByRole('button', { name: /DON’T Stop/ })).toBeInTheDocument()
  })

  it('browses the master library, filters it, and explains one track', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await openSection(/^Library/)
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()

    const table = screen.getByLabelText('Master library')
    expect(within(table).getAllByRole('button')).toHaveLength(2)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search the library' }), 'clay')
    expect(within(table).getAllByRole('button')).toHaveLength(1)

    await userEvent.click(within(table).getByRole('button', { name: 'Clay Drums by Nilo & Sefa' }))
    const detail = screen.getByLabelText('Track detail')
    expect(within(detail).getByRole('heading', { name: 'Clay Drums' })).toBeInTheDocument()
    expect(within(detail).getByText('fixture')).toBeInTheDocument()
    expect(within(detail).getByText(/92% confidence/)).toBeInTheDocument()
  })

  it('lists platform playlists with their sync state and syncs one into the library', async () => {
    spotifyConnected.mockResolvedValue(true)
    spotifyPlaylists.mockResolvedValue([
      { ID: 'afro', Name: 'Afro Vibezz', Kind: 'source', Writable: false, ImageURL: 'https://image.test/afro', TrackCount: 42, Synced: true },
      { ID: 'techno', Name: 'Techno Vibezz', Kind: 'source', Writable: false, ImageURL: 'https://image.test/techno', TrackCount: 30, Synced: false },
    ])
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await openSection(/^Sources/)

    expect(screen.getByRole('heading', { name: 'Spotify' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TIDAL' })).toBeInTheDocument()
    expect(screen.getByText('In the master library')).toBeInTheDocument()
    expect(screen.getByText('Available on Spotify')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-sync Afro Vibezz' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sync Techno Vibezz' }))
    await waitFor(() => expect(syncSpotifyPlaylists).toHaveBeenCalledWith(['techno']))
  })

  it('shows album art and colour-coded Camelot keys in the mix sheet', async () => {
    const illustrated = {
      ...draft,
      tracks: draft.tracks.map((item, index) => ({ ...item, track: { ...item.track, albumImageUrl: `https://image.test/${index}`, camelot: index === 0 ? '8A' : '9A' } })),
    }
    bootstrap.mockResolvedValue({ ...bootstrapData, drafts: [illustrated], tracks: illustrated.tracks.map((item) => item.track) })
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    expect(document.querySelectorAll('.mix-sheet .artwork img')).toHaveLength(2)
    const keys = document.querySelectorAll('.mix-sheet .camelot')
    expect(keys).toHaveLength(2)
    expect(keys[0].getAttribute('style')).not.toBe(keys[1].getAttribute('style'))
  })

  it('switches to the persistent dark theme with the requested accent', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await userEvent.click(screen.getByRole('button', { name: 'Use dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem('cueflow-theme')).toBe('dark')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe('#DEFF00')
    expect(screen.getByRole('button', { name: 'Use light mode' })).toBeInTheDocument()
  })

  it('opens the provenance-aware research queue from the sidebar', async () => {
    needsReview.mockResolvedValue([{ ...draft.tracks[0].track, id: 'review-me', featureNeedsReview: true, bpm: 0, musicalKey: '', camelot: '' }])
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await openSection(/Research 1/)
    expect(screen.getByRole('heading', { name: 'Salt Horizon' })).toBeInTheDocument()
    expect(screen.getByText(/Listen beyond the store tag/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save reviewed features/ })).toBeInTheDocument()
  })

  it('drops the waveform panel entirely when the recording has no analysis', async () => {
    trackWaveform.mockResolvedValue({ trackId: 'one', durationSeconds: 0, waveform: [] })
    render(<App />)
    await screen.findByRole('heading', { name: 'Afro to pressure — A' })
    await waitFor(() => expect(trackWaveform).toHaveBeenCalled())
    expect(screen.queryByLabelText(/Full waveform for/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Set track list')).toBeInTheDocument()
  })
})
