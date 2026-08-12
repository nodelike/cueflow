import type { CSSProperties } from 'react'

export function CamelotKey({ value, compact = false }: { value: string; compact?: boolean }) {
  const number = Number.parseInt(value, 10)
  const hue = Number.isFinite(number) && number > 0 ? ((number - 1) * 30) % 360 : 0
  return <span className={`camelot-key ${compact ? 'compact' : ''}`} style={{ '--key-hue': hue } as CSSProperties}>{value || '—'}</span>
}
