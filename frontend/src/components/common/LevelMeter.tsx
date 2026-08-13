/** Vertical level for one track. Scanning a column of these reads as the arc. */
export function LevelMeter({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <span className="level" role="img" aria-label={`${label} ${percent} of 100`} title={`${percent}`}>
      <span style={{ height: `${Math.max(6, percent)}%` }} />
    </span>
  )
}
