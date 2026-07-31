const STORAGE_OPEN = 'gt-chat-panel-open'
/** CustomEvent — TopNav / CommandPalette / deep-link open chat without a full-page takeover. */
export const OPEN_CHAT_EVENT = 'gt-open-chat-panel'
export const CLOSE_CHAT_EVENT = 'gt-close-chat-panel'

export function readChatPanelOpen(defaultOpen = false) {
  try {
    const raw = localStorage.getItem(STORAGE_OPEN)
    if (raw == null) return defaultOpen
    return raw === '1' || raw === 'true'
  } catch {
    return defaultOpen
  }
}

export function writeChatPanelOpen(open) {
  try {
    localStorage.setItem(STORAGE_OPEN, open ? '1' : '0')
  } catch {
    // ignore
  }
}

/**
 * Open the left chat slide-out in-place (TopNav stays).
 * @param {{ channelId?: number|string, focusCreate?: boolean }} [detail]
 */
export function requestOpenChatPanel(detail = {}) {
  writeChatPanelOpen(true)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: detail || {} }))
}

export function requestCloseChatPanel() {
  writeChatPanelOpen(false)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CLOSE_CHAT_EVENT))
}

/** Slug for create-room POST — lowercase alnum + hyphens. */
export function slugifyRoomName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function channelKind(channel) {
  return channel?.kind || channel?.type || ''
}

/**
 * Archive chrome — household channels only; creator or librarian+.
 * @param {object|null} channel
 * @param {{ isLibrarian?: boolean, isAdmin?: boolean, userId?: number|string|null }} [viewer]
 */
export function canArchiveChannel(channel, viewer = {}) {
  if (!channel || channelKind(channel) === 'dm') return false
  if (viewer.isLibrarian || viewer.isAdmin) return true
  const uid = Number(viewer.userId)
  if (!Number.isFinite(uid) || channel.created_by_user_id == null) return false
  return Number(channel.created_by_user_id) === uid
}

/** Leave is available for any active room (DM drop / channel mute per API). */
export function canLeaveChannel(channel) {
  return Boolean(channel?.id)
}
