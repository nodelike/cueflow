import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Modal shell: escape to close, backdrop click to close, labelled for readers. */
export function Dialog({ title, description, busy = false, onClose, children, footer }: Props) {
  const titleID = useId()

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [busy, onClose])

  return (
    <div className="backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleID}>
        <header>
          <div>
            <h2 id={titleID}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="btn icon ghost" onClick={onClose} disabled={busy} aria-label={`Close ${title.toLowerCase()}`}>
            <X size={17} />
          </button>
        </header>
        {children}
        {footer}
      </div>
    </div>
  )
}
