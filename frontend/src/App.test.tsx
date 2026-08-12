import { render, screen } from '@testing-library/react'
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
  beforeEach(() => { bootstrap.mockResolvedValue(bootstrapData); generateSets.mockResolvedValue([draft]); needsReview.mockResolvedValue([]); enrichTrack.mockResolvedValue(undefined) })

  it('renders the persisted set and exposes transition reasoning', async () => {
    render(<App />)
    expect(await screen.findByText('Afro to pressure — A')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /2\. Clay Drums/ }))
    expect(screen.getByText(/tempo locks cleanly/i)).toBeInTheDocument()
    expect(screen.getByText('adjacent Camelot movement')).toBeInTheDocument()
  })

  it('submits the tunable set brief', async () => {
    render(<App />)
    await screen.findByText('Afro to pressure — A')
    await userEvent.click(screen.getByRole('button', { name: 'Generate set variations' }))
    expect(generateSets).toHaveBeenCalledWith(expect.objectContaining({ arc: 'journey', durationMinutes: 60, variationCount: 3 }))
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
