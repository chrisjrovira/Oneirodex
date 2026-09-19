import { createOneirodexBrowserClient } from '@oneirodex/api-client'
import type { AccountSummary } from '../accountApi.js'
import { getCsrfToken } from '../csrf.js'

/* Client, panel registry and helpers moved out of AccountModal (v11 cycle, H-D.2) — unchanged. */

export const accountClient = createOneirodexBrowserClient({
  baseUrl: '',
  fetchImpl: (input, init) => fetch(input, init),
  csrfToken: getCsrfToken,
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})

/**
 * Account modals: profile, avatar, password, invites, API tokens.
 *
 * Each of these was a page you navigated to. That is a whole-page trip, a lost
 * scroll position and a browser back button, for a two-field form — and because
 * they were server-rendered in an older idiom, arriving at one also looked like
 * leaving the app. They open here instead, in the same panel object the game
 * preview uses, and they switch between each other without closing.
 *
 * The server-rendered pages are still there and still work; they are the no-JS
 * and Big Picture path. This replaces the *route* the member takes to them, not
 * the routes themselves.
 */

/** The five sections the modal switches between. */
export type AccountPanelId = 'profile' | 'avatar' | 'password' | 'invites' | 'tokens'

/** One entry in the account section tab strip. */
export interface AccountPanel {
  id: AccountPanelId
  label: string
  title: string
}

export const ACCOUNT_PANELS: AccountPanel[] = [
  { id: 'profile', label: 'Profile', title: 'Profile' },
  { id: 'avatar', label: 'Avatar', title: 'Change avatar' },
  { id: 'password', label: 'Password', title: 'Change password' },
  { id: 'invites', label: 'Invites', title: 'Invites' },
  { id: 'tokens', label: 'API tokens', title: 'API tokens' },
]

export const PANEL_IDS: Set<string> = new Set(ACCOUNT_PANELS.map((panel) => panel.id))

/** True when `value` names one of {@link ACCOUNT_PANELS}. */
export function isPanelId(value: unknown): value is AccountPanelId {
  return typeof value === 'string' && PANEL_IDS.has(value)
}

export function panelTitle(id: string): string {
  return ACCOUNT_PANELS.find((panel) => panel.id === id)?.title || 'Account'
}

/**
 * Where to load an avatar from.
 *
 * Prefers the server's resolved `avatar_url`, which routes the shipped avatars
 * through the active theme — they are flat SVGs rendered as `<img>`, so they
 * cannot pick up a theme colour on their own and stayed default-green on every
 * preset until the server started recolouring them.
 *
 * `avatar_path` remains the fallback and the identity: it is what the client
 * sends back when picking a stock avatar, and it is what an older server (or
 * one whose theme folders predate the recoloured copies) will be sending.
 */
export function avatarSrc(
  summary: AccountSummary | null | undefined,
  path: string | null | undefined,
): string {
  const resolved = summary?.avatar_url
  if (resolved && (!path || path === summary?.avatar_path)) return resolved
  if (!path) return ''
  return path.startsWith('/') ? path : `/static/${path}`
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

/** Read `error` off a thrown envelope error without leaking `[object Object]`. */
export function messageOf(error: unknown, fallback: string): string {
  const raw =
    error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.trim()
      : ''
  return raw || fallback
}
