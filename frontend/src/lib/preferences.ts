import type { Section } from '../types'

const requiredTracksKey = 'cueflow-required-track-ids'
const sourcePlaylistsKey = 'cueflow-source-playlist-ids'
const sectionKey = 'cueflow-section'

function readIDs(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  } catch {
    return []
  }
}

export function getSavedRequiredTrackIDs(): string[] {
  return readIDs(requiredTracksKey)
}

export function saveRequiredTrackIDs(ids: string[]) {
  window.localStorage.setItem(requiredTracksKey, JSON.stringify(ids))
}

export function getSavedSourcePlaylistIDs(): string[] {
  return readIDs(sourcePlaylistsKey)
}

export function saveSourcePlaylistIDs(ids: string[]) {
  window.localStorage.setItem(sourcePlaylistsKey, JSON.stringify(ids))
}

const briefKey = 'cueflow-brief-open'

export function getSavedBriefOpen(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(briefKey) !== 'closed'
}

export function saveBriefOpen(open: boolean) {
  window.localStorage.setItem(briefKey, open ? 'open' : 'closed')
}

const sections: Section[] = ['studio', 'library', 'sources', 'research']

export function getSavedSection(): Section {
  if (typeof window === 'undefined') return 'studio'
  const saved = window.localStorage.getItem(sectionKey)
  return sections.find((section) => section === saved) ?? 'studio'
}

export function saveSection(section: Section) {
  window.localStorage.setItem(sectionKey, section)
}
