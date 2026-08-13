import { Disc3, Headphones, Library, Link2, Moon, RefreshCw, Sliders, Sun, Waves } from 'lucide-react'
import type { Section } from '../../types'
import type { Theme } from '../../lib/theme'

type Props = {
  section: Section
  trackCount: number
  crateCount: number
  researchCount: number
  spotifyReady: boolean
  busy: boolean
  theme: Theme
  onNavigate: (section: Section) => void
  onConnect: () => void
  onToggleTheme: () => void
  onRefresh: () => void
}

const items: Array<{ id: Section; label: string; icon: typeof Disc3; shortcut: string }> = [
  { id: 'studio', label: 'Studio', icon: Sliders, shortcut: '⌘1' },
  { id: 'library', label: 'Library', icon: Library, shortcut: '⌘2' },
  { id: 'sources', label: 'Sources', icon: Waves, shortcut: '⌘3' },
  { id: 'research', label: 'Research', icon: Headphones, shortcut: '⌘4' },
]

export function Sidebar({ section, trackCount, crateCount, researchCount, spotifyReady, busy, theme, onNavigate, onConnect, onToggleTheme, onRefresh }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Disc3 size={18} /><strong>Cueflow</strong></div>

      <nav className="sidebar-nav scroll" aria-label="Sections">
        {items.map(({ id, label, icon: Icon, shortcut }) => (
          <button
            type="button"
            key={id}
            className={`nav-item${section === id ? ' active' : ''}`}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
            {id === 'research' && researchCount > 0
              ? <span className="nav-count">{researchCount}</span>
              : <kbd>{shortcut}</kbd>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          type="button"
          className={`link-state${spotifyReady ? ' connected' : ' action'}`}
          disabled={busy || spotifyReady}
          onClick={onConnect}
        >
          <Link2 size={15} />
          <span className="truncate">{spotifyReady ? 'Spotify connected' : 'Connect Spotify'}</span>
        </button>
        <div className="sidebar-stats">
          <span>{trackCount} tracks</span>
          <span>{crateCount} crates</span>
        </div>
        <div className="sidebar-tools">
          <button type="button" className="btn sm icon ghost" onClick={onRefresh} aria-label="Refresh library"><RefreshCw size={14} /></button>
          <button
            type="button"
            className="btn sm icon ghost"
            onClick={onToggleTheme}
            aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
