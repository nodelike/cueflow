import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { bootstrapData, draft } from './test/fixtures'

const bootstrap = vi.fn()
const generateSets = vi.fn()
const needsReview = vi.fn()
const enrichTrack = vi.fn()
vi.mock('./api', () => ({
  bootstrap: () => bootstrap(),
  generateSets: (...args: unknown[]) => generateSets(...args),
  seedReferenceCatalog: vi.fn(),
  spotifyConnected: vi.fn().mockResolvedValue(false),
  connectSpotify: vi.fn(),
  publishSet: vi.fn(),
  needsReview: () => needsReview(),
  enrichTrack: (...args: unknown[]) => enrichTrack(...args),
}))

describe('Cueflow set desk', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    bootstrap.mockResolvedValue(bootstrapData); generateSets.mockResolvedValue([draft]); needsReview.mockResolvedValue([]); enrichTrack.mockResolvedValue(undefined)
  })

  it('renders the persisted set and exposes transition reasoning', async () => {
    render(<App />)
    expect(await screen.findByText('Afro to pressure — A')).toBeInTheDocument()
    await userEvent.click(within(screen.getByLabelText('Set track list')).getByRole('button', { name: /2\. Clay Drums/ }))
    expect(screen.getByText(/tempo locks cleanly/i)).toBeInTheDocument()
    expect(screen.getByText('adjacent Camelot movement')).toBeInTheDocument()
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

  it('opens the provenance-aware research queue', async () => {
    needsReview.mockResolvedValue([{ ...draft.tracks[0].track, id: 'review-me', featureNeedsReview: true, bpm: 0, musicalKey: '', camelot: '' }])
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: /Research 1/ }))
    expect(screen.getByRole('heading', { name: 'Salt Horizon' })).toBeInTheDocument()
    expect(screen.getByText(/Listen beyond the store tag/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save reviewed features/ })).toBeInTheDocument()
  })
})
