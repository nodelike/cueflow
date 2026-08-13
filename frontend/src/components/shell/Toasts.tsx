import { Check } from 'lucide-react'

export type Toast = { id: number; message: string }

/** Transient confirmations. Failures use the persistent banner instead. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast ok">
          <Check size={15} />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
