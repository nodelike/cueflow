export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours ? `${hours}h ${remaining.toString().padStart(2, '0')}m` : `${remaining}m`
}

/** mm:ss, the way a deck displays it. */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

/** "just now" / "4h ago" / "12 Aug" — enough to judge how stale a sync is. */
export function formatSince(value: string) {
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return 'never'
  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 8) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(then)
}

export function formatBpm(bpm: number) {
  if (!bpm) return '—'
  return bpm.toFixed(bpm % 1 === 0 ? 0 : 1)
}

export function plural(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function padPosition(position: number) {
  return String(position).padStart(2, '0')
}
