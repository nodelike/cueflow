const requiredTracksKey = 'cueflow-required-track-ids'

export function getSavedRequiredTrackIDs(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(requiredTracksKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  } catch {
    return []
  }
}

export function saveRequiredTrackIDs(ids: string[]) {
  window.localStorage.setItem(requiredTracksKey, JSON.stringify(ids))
}
