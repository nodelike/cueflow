import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  options: SelectOption[]
  ariaLabel: string
  className?: string
  onChange: (value: string) => void
}

/** Dropdown that looks like the rest of Cueflow instead of the OS menu.
 *  Keyboard contract matches a native select: arrows move, Enter picks,
 *  Escape closes, and the trigger keeps focus throughout. */
export function Select({ value, options, ariaLabel, className = '', onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)))
  const holder = useRef<HTMLDivElement>(null)
  const listID = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    function onPointerDown(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open, options, value])

  function commit(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + options.length) % options.length)
    }
    if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1) }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[active]
      if (option) commit(option.value)
    }
  }

  return (
    <div className={`select ${className}`.trim()} ref={holder}>
      <button
        type="button"
        role="combobox"
        className="select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listID}
        aria-activedescendant={open ? `${listID}-${active}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="select-list" role="listbox" id={listID} aria-label={ariaLabel}>
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listID}-${index}`}
              role="option"
              className={`select-option${index === active ? ' active' : ''}`}
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => { event.preventDefault(); commit(option.value) }}
            >
              <i>{option.value === value && <Check size={13} />}</i>
              <span className="truncate">{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
