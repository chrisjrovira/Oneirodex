import { formatLocaleDate } from '../../utils/formatLocaleDate'

/* Helpers and constants moved out of NewsPage (v11 cycle, H-D.2). */

export function formatEndsAt(value: unknown): string | null {
  if (!value) {
    return null
  }
  return formatLocaleDate(value, { fallback: null })
}

export function storeLabel(store: unknown): string {
  const key = String(store ?? '')
  const map: Record<string, string> = {
    steam: 'Steam',
    epic: 'Epic',
    gog: 'GOG',
    amazon: 'Amazon',
    itch: 'itch.io',
    humble: 'Humble',
    other: 'Store',
  }
  return (map as Record<string, string>)[key] || key || 'Store'
}

export function truncate(text: unknown, max = 140): string {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}…`
}

export function tabFromHash() {
  if (typeof window === 'undefined') return null
  const hash = (window.location.hash || '').replace(/^#/, '')
  if (hash === 'free-games' || hash === 'free') return 'free'
  return null
}

// One list, two renderers: the old tab strip and bar two's segmented control
// must never drift apart into different sets of sections.
export const MUTED_SOURCES_KEY = 'od.news.mutedSources'

export const NEWS_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'admins', label: 'Admins' },
  { id: 'free', label: 'Free now' },
  { id: 'headlines', label: 'Headlines' },
]

export const LAYOUT_STORAGE_KEY = 'od.news.layout'
export const NEWS_LAYOUTS = [
  { id: 'card', label: 'Card' },
  { id: 'grid', label: 'Grid' },
  { id: 'rss', label: 'RSS' },
]

export function readNewsLayout() {
  try {
    const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (value === 'card' || value === 'grid' || value === 'rss') return value
  } catch {
    // View preference only — Card is the honest default.
  }
  return 'card'
}

export function persistNewsLayout(value: string) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, value)
  } catch {
    // View preference only.
  }
}
