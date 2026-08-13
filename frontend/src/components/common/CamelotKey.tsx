import type { CSSProperties } from 'react'

/** Camelot wheel position, hue-coded so harmonic neighbours look adjacent. */
export function CamelotKey({ value }: { value: string }) {
  const number = Number.parseInt(value, 10)
  const hue = Number.isFinite(number) && number > 0 ? ((number - 1) * 30) % 360 : 0
  return <span className="camelot" style={{ '--key-hue': hue } as CSSProperties}>{value || '—'}</span>
}
