import type { ReactNode } from 'react'

export function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="fact">{icon}<span>{label}</span><strong>{value}</strong></div>
}
