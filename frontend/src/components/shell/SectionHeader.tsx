import type { ReactNode } from 'react'

/** Draggable window strip that names the current workspace and hosts its actions. */
export function SectionHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="section-header">
      <div className="section-title">
        <h1>{title}</h1>
        {subtitle && <p className="truncate">{subtitle}</p>}
      </div>
      {children && <div className="section-tools">{children}</div>}
    </header>
  )
}
