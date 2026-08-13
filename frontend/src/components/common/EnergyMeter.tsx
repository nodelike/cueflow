/** Compact 0–1 energy readout. */
export function EnergyMeter({ value, label }: { value: number; label?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <span className="meter" role="img" aria-label={`${label ?? 'Energy'} ${percent} of 100`}>
      <span style={{ width: `${percent}%` }} />
    </span>
  )
}
