import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'

const STORAGE_OPEN = 'od-social-companion-open'
const STORAGE_PINNED = 'od-social-companion-pinned'
/** CustomEvent name — TopNav / CommandPalette open the dock without SPA navigation. */
export const OPEN_SOCIAL_EVENT = 'od-open-social-companion'

export function presenceLabel(status) {
  if (status === 'in-game') return 'In game'
  if (status === 'online') return 'Online'
  if (status === 'away') return 'Away'
  return 'Offline'
}

export function readCompanionOpen(defaultOpen = false) {
  try {
    const raw = localStorage.getItem(STORAGE_OPEN)
    if (raw == null) return defaultOpen
    return raw === '1' || raw === 'true'
  } catch {
    return defaultOpen
  }
}

export function writeCompanionOpen(open) {
  try {
    localStorage.setItem(STORAGE_OPEN, open ? '1' : '0')
  } catch {
    // ignore
  }
}

export function readCompanionPinned(defaultPinned = true) {
  try {
    const raw = localStorage.getItem(STORAGE_PINNED)
    if (raw == null) return defaultPinned
    return raw === '1' || raw === 'true'
  } catch {
    return defaultPinned
  }
}

export function writeCompanionPinned(pinned) {
  try {
    localStorage.setItem(STORAGE_PINNED, pinned ? '1' : '0')
  } catch {
    // ignore
  }
}

export async function fetchSocialStatus({ signal } = {}) {
  const response = await fetch('/api/social/status', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) return null
  return response.json()
}

export async function fetchFriendsList({ signal } = {}) {
  const response = await fetch('/api/social/friends', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) return { friends: [] }
  return response.json()
}

export async function openDirectMessage({ userId, username } = {}) {
  const body = userId ? { user_id: userId } : { username }
  const response = await fetch('/api/chat/dm', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw errorFromBody(data, response.status, 'Could not open DM')
  }
  return data
}

export async function mintPartyToken({ gameUuid, spectator = false } = {}) {
  const id = (gameUuid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  const room = id ? `household:party:${id}` : 'household:lobby'
  const response = await fetch('/api/rtc/token', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ room, spectator: spectator || undefined }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw errorFromBody(data, response.status, 'Voice party unavailable')
  }
  return { ...data, room }
}

export function partyInvitePath(gameUuid) {
  const id = (gameUuid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  const qs = new URLSearchParams({ room: id ? `household:party:${id}` : 'household:lobby' })
  if (gameUuid) qs.set('game', gameUuid)
  return `/activity?${qs.toString()}`
}

export function shareGamePath(gameUuid) {
  if (!gameUuid) return '/library'
  return `/game_details/${encodeURIComponent(gameUuid)}`
}

export function openSocialPopoutWindow() {
  const features = 'width=380,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
  const win = window.open('/social-companion', 'od-social-companion', features)
  if (win) {
    try {
      win.focus()
    } catch {
      // ignore
    }
  }
  return win
}

/**
 * Open the bottom-right Friends dock in-place (no `/social-companion` shell swap).
 * Falls back to pop-out when the dock is not mounted (e.g. already on the popout host).
 */
export function requestOpenSocialCompanion() {
  writeCompanionOpen(true)
  if (typeof window === 'undefined') return null
  const path = window.location?.pathname || ''
  if (path.startsWith('/social-companion')) {
    return openSocialPopoutWindow()
  }
  window.dispatchEvent(new CustomEvent(OPEN_SOCIAL_EVENT))
  return null
}
