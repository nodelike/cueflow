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
vi.mock('./api', () => ({
  bootstrap: () => bootstrap(),
  generateSets: (...args: unknown[]) => generateSets(...args),
  seedReferenceCatalog: vi.fn(),
  spotifyConnected: () => spotifyConnected(),
  spotifyPlaylists: () => spotifyPlaylists(),
  syncSpotifyPlaylists: (...args: unknown[]) => syncSpotifyPlaylists(...args),
  connectSpotify: vi.fn(),
  publishSet: vi.fn(),
  needsReview: () => needsReview(),
  enrichTrack: (...args: unknown[]) => enrichTrack(...args),
  trackWaveform: (...args: unknown[]) => trackWaveform(...args),
  saveTransitionFeedback: (...args: unknown[]) => saveTransitionFeedback(...args),
}))

describe('Cueflow set desk', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    bootstrap.mockResolvedValue(bootstrapData); generateSets.mockResolvedValue([draft]); needsReview.mockResolvedValue([]); enrichTrack.mockResolvedValue(undefined)
    spotifyConnected.mockResolvedValue(false); spotifyPlaylists.mockResolvedValue([]); syncSpotifyPlaylists.mockResolvedValue(bootstrapData)
    trackWaveform.mockImplementation((trackID: string) => Promise.resolve({
      trackId: trackID,
      durationSeconds: draft.tracks.find((item) => item.track.id === trackID)?.track.durationSeconds ?? 300,
      analyzerVersion: 'fixture/1',
      waveform: Array.from({ length: 12 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, rms: .12 + index * .015, peak: .3 + index * .025 })),
    }))
    saveTransitionFeedback.mockImplementation((fromTrackId: string, toTrackId: string, verdict: 'compatible' | 'incompatible') => Promise.resolve({ fromTrackId, toTrackId, verdict, recordedAt: '2026-08-13T12:00:00Z' }))
  })

  it('renders the persisted set and exposes transition reasoning', async () => {
    render(<App />)
    expect(await screen.findByText('Afro to pressure — A')).toBeInTheDocument()
    expect(screen.getByText('heuristic fit')).toBeInTheDocument()
    const saltWaveform = screen.getByLabelText('Full waveform for Salt Horizon')
    expect(await within(saltWaveform).findByRole('img', { name: /Full-track peak and RMS waveform for Salt Horizon/i })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Track and transition inspector')).queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Planned cue windows')).toHaveTextContent(/out 04:08–04:40/i)
    await userEvent.click(within(screen.getByLabelText('Set track list')).getByRole('button', { name: /2\. Clay Drums/ }))
    expect(await screen.findByRole('img', { name: /Full-track peak and RMS waveform for Clay Drums/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Planned cue windows')).toHaveTextContent(/in 00:00–00:32/i)
    expect(screen.getByText(/rendered-audio validation is still required/i)).toBeInTheDocument()
    expect(screen.getByText(/Transition in · cue-window plan/i)).toBeInTheDocument()
    expect(screen.getByText(/bass exchange at bar 8/i)).toBeInTheDocument()
    expect(screen.getByText('adjacent Camelot movement')).toBeInTheDocument()
  })

  it('captures a field-tested transition in one tap and lets the verdict change', async () => {
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    const fieldTest = screen.getByLabelText('Field test Salt Horizon into Clay Drums')
    expect(within(fieldTest).getByText(/tap what your ears say/i)).toBeInTheDocument()

    await userEvent.click(within(fieldTest).getByRole('button', { name: 'Works' }))
    await waitFor(() => expect(saveTransitionFeedback).toHaveBeenCalledWith('one', 'two', 'compatible'))
    expect(within(fieldTest).getByRole('button', { name: 'Works' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(fieldTest).getByText(/future sets can reuse it/i)).toBeInTheDocument()

    await userEvent.click(within(fieldTest).getByRole('button', { name: "Doesn't" }))
    await waitFor(() => expect(saveTransitionFeedback).toHaveBeenLastCalledWith('one', 'two', 'incompatible'))
    expect(within(fieldTest).getByRole('button', { name: "Doesn't" })).toHaveAttribute('aria-pressed', 'true')
    expect(within(fieldTest).getByText(/future sets will steer away/i)).toBeInTheDocument()
  })

  it('submits the tunable set brief', async () => {
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ arc: 'journey', durationMinutes: 60, variationCount: 3 }))
  })

  it('searches, requires, and restores must-play tracks after a restart', async () => {
    const firstRun = render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Choose tracks' }))
    const picker = screen.getByRole('dialog', { name: 'Choose must-play tracks' })
    await userEvent.type(within(picker).getByRole('searchbox', { name: 'Search tracks' }), 'Clay')
    await userEvent.click(within(picker).getByRole('button', { name: /Clay Drums/ }))
    await userEvent.click(within(picker).getByRole('button', { name: 'Done' }))
    expect(within(screen.getByLabelText('Set brief')).getByText('Clay Drums')).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem('cueflow-required-track-ids')).toBe('["two"]'))
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ requiredTrackIds: ['two'] }))

    firstRun.unmount()
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    expect(within(screen.getByLabelText('Set brief')).getByText('Clay Drums')).toBeInTheDocument()
  })

  it('matches track search without caring about case, punctuation, accents, or spacing', async () => {
    const looseMatchTrack = { ...draft.tracks[0].track, id: 'loose-match', title: "DON’T Stop", artist: 'Café Noir' }
    bootstrap.mockResolvedValue({ ...bootstrapData, tracks: [...bootstrapData.tracks, looseMatchTrack] })
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Choose tracks' }))
    const picker = screen.getByRole('dialog', { name: 'Choose must-play tracks' })
    const search = within(picker).getByRole('searchbox', { name: 'Search tracks' })

    await userEvent.type(search, 'dont')
    expect(within(picker).getByRole('button', { name: /DON’T Stop/ })).toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, 'CAFE NOIR')
    expect(within(picker).getByRole('button', { name: /DON’T Stop/ })).toBeInTheDocument()
  })

  it('switches to the persistent dark theme with the requested accent', async () => {
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Use dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem('cueflow-theme')).toBe('dark')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe('#DEFF00')
    expect(screen.getByRole('button', { name: 'Use light mode' })).toBeInTheDocument()
  })

  it('lets the user choose and persist Spotify source playlists', async () => {
    spotifyConnected.mockResolvedValue(true)
    spotifyPlaylists.mockResolvedValue([
      { ID: 'afro', Name: 'Afro Vibezz', Kind: 'source', Writable: false, ImageURL: 'https://image.test/afro', TrackCount: 42, Synced: true },
      { ID: 'techno', Name: 'Techno Vibezz', Kind: 'source', Writable: false, ImageURL: 'https://image.test/techno', TrackCount: 30, Synced: false },
    ])
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Choose playlists' }))
    const picker = screen.getByRole('dialog', { name: 'Choose source crates' })
    await userEvent.type(within(picker).getByRole('searchbox', { name: 'Search playlists' }), 'techno')
    await userEvent.click(within(picker).getByRole('button', { name: /Techno Vibezz/ }))
    await userEvent.click(within(picker).getByRole('button', { name: 'Sync & use' }))
    await waitFor(() => expect(syncSpotifyPlaylists).toHaveBeenCalledWith(['techno']))
    await waitFor(() => expect(window.localStorage.getItem('cueflow-source-playlist-ids')).toBe('["techno"]'))
  })

  it('shows album art and color-coded Camelot keys in the set', async () => {
    const illustrated = {
      ...draft,
      tracks: draft.tracks.map((item, index) => ({ ...item, track: { ...item.track, albumImageUrl: `https://image.test/${index}`, camelot: index === 0 ? '8A' : '9A' } })),
    }
    bootstrap.mockResolvedValue({ ...bootstrapData, drafts: [illustrated], tracks: illustrated.tracks.map((item) => item.track) })
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    expect(document.querySelectorAll('.track-ledger .track-artwork img')).toHaveLength(2)
    const keys = document.querySelectorAll('.track-ledger .camelot-key')
    expect(keys).toHaveLength(2)
    expect(keys[0].getAttribute('style')).not.toBe(keys[1].getAttribute('style'))
  })

  it('opens the provenance-aware research queue', async () => {
    needsReview.mockResolvedValue([{ ...draft.tracks[0].track, id: 'review-me', featureNeedsReview: true, bpm: 0, musicalKey: '', camelot: '' }])
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: /Research 1/ }))
    expect(screen.getByRole('heading', { name: 'Salt Horizon' })).toBeInTheDocument()
    expect(screen.getByText(/Listen beyond the store tag/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save reviewed features/ })).toBeInTheDocument()
  })

  it('explains when the selected track has no full-track waveform analysis', async () => {
    trackWaveform.mockResolvedValue({ trackId: 'one', durationSeconds: 0, waveform: [] })
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    expect(await screen.findByText('Full recording not linked')).toBeInTheDocument()
    expect(screen.getByText(/Import or link the complete audio file/i)).toBeInTheDocument()
  })
})
