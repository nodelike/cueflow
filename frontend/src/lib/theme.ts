export type Theme = 'light' | 'dark'

const storageKey = 'cueflow-theme'

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(storageKey)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function saveTheme(theme: Theme) {
  window.localStorage.setItem(storageKey, theme)
  applyTheme(theme)
}
