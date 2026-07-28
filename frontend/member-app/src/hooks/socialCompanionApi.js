const STORAGE_OPEN = 'gt-social-companion-open'
const STORAGE_PINNED = 'gt-social-companion-pinned'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

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
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not open DM')
  }
  return data
}

export async function mintPartyToken({ gameUuid, spectator = false } = {}) {
  const id = (gameUuid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  const room = id ? `household:party:${id}` : 'household:lobby'
  const response = await fetch('/api/rtc/token', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify({ room, spectator: spectator || undefined }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Voice party unavailable')
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
  const win = window.open('/social-companion', 'gt-social-companion', features)
  if (win) {
    try {
      win.focus()
    } catch {
      // ignore
    }
  }
  return win
}
