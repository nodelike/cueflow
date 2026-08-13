import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  label: ReactNode
  ariaLabel: string
  className?: string
  align?: 'start' | 'end'
  width?: number
  children: ReactNode
}

/** A control that keeps its rarely-touched detail one click away. */
export function Popover({ label, ariaLabel, className = '', align = 'start', width = 280, children }: Props) {
  const [open, setOpen] = useState(false)
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="popover-holder" ref={holder}>
      <button
        type="button"
        className={className || 'btn'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <ChevronDown size={13} className="popover-caret" />
      </button>
      {open && (
        <div className={`popover ${align}`} style={{ width }} role="dialog" aria-label={ariaLabel}>
          {children}
        </div>
      )}
    </div>
  )
}
