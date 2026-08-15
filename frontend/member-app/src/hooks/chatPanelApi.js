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

/** Soft-wired upload path — Backend may land in parallel; UI feature-detects 404. */
export function chatAttachmentUploadUrl(channelId) {
  return `/api/chat/channels/${channelId}/attachments`
}

export function isImageAttachment(att) {
  if (!att || typeof att !== 'object') return false
  const ct = String(att.content_type || att.mime || att.mime_type || '').toLowerCase()
  if (ct.startsWith('image/')) return true
  const name = String(att.filename || att.name || att.url || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)
}

export function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      id: row.id ?? row.attachment_id ?? null,
      url: row.url || row.href || row.download_url || '',
      filename: row.filename || row.name || row.original_name || 'file',
      content_type: row.content_type || row.mime || row.mime_type || '',
      size: row.size ?? row.byte_size ?? null,
    }))
    .filter((row) => row.url || row.id != null)
}

/**
 * Probe whether channel attachment upload exists (OPTIONS or empty POST → 404 = off).
 * @returns {Promise<'yes'|'no'|'unknown'>}
 */
export async function probeChatAttachmentUpload(channelId) {
  if (!channelId) return 'unknown'
  const url = chatAttachmentUploadUrl(channelId)
  try {
    const optionsRes = await fetch(url, { method: 'OPTIONS', credentials: 'same-origin' })
    if (optionsRes.status === 404) return 'no'
    if (optionsRes.ok || optionsRes.status === 204 || optionsRes.status === 405) return 'yes'
  } catch {
    // Fall through to a no-body POST probe.
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || '' },
      body: new FormData(),
    })
    if (response.status === 404 || response.status === 405) return 'no'
    // 400/401/403/413/415 → route exists
    if (response.status !== 404) return 'yes'
  } catch {
    return 'unknown'
  }
  return 'no'
}

/**
 * Multipart upload for chat attach. Soft-degrades on 404.
 * @returns {Promise<{ ok: boolean, unavailable?: boolean, attachment?: object, error?: string, status: number }>}
 */
export async function uploadChatAttachment(channelId, file, { csrf = '' } = {}) {
  if (!channelId || !file) {
    return { ok: false, status: 0, error: 'Missing channel or file' }
  }
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(chatAttachmentUploadUrl(channelId), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': csrf },
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 404 || response.status === 405) {
    return {
      ok: false,
      unavailable: true,
      status: response.status,
      error: data.error || 'File attach isn’t available yet',
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data.error || 'Upload failed',
    }
  }
  const attachment = data.attachment || data.file || data
  return { ok: true, status: response.status, attachment }
}

/**
 * Pop chat out into its own window (GT-B17 · UID-010).
 *
 * Friends has had this since the social wave (`openSocialPopoutWindow`); chat
 * never did, so talking to someone meant keeping the slide-out over the library
 * — you could chat or browse, not both. That is the whole complaint: chat was
 * modal in practice even though it looked like a panel.
 *
 * `?popout=1` renders the route without the rail and top bar. A 380px window
 * showing a 13.5rem navigation rail would leave almost nothing for the
 * conversation.
 */
export function openChatPopoutWindow(channelId) {
  const params = new URLSearchParams({ popout: '1' })
  if (channelId != null) params.set('channel', String(channelId))
  const features =
    'width=420,height=760,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
  const win = window.open(`/chat?${params.toString()}`, 'gt-chat-popout', features)
  if (win) {
    try {
      win.focus()
    } catch {
      // Focus can throw under popup blockers; the window still opened.
    }
  }
  // Closing the in-page panel is the point — two copies of the same
  // conversation side by side is worse than either alone.
  requestCloseChatPanel()
  return win
}

/** True when the current document is a chrome-less pop-out host. */
export function isPopoutWindow() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('popout') === '1'
}
