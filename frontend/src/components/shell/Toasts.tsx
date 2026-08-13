import { AlertCircle, Check } from 'lucide-react'

export type Toast = { id: number; tone: 'ok' | 'bad'; message: string }

export function Toasts({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          {toast.tone === 'ok' ? <Check size={15} /> : <AlertCircle size={15} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
