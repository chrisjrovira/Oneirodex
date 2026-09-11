/**
 * Household chat: channels, DMs, messages, spaces, attachments.
 *
 * JSON calls lived as inlined `fetch` in ChatPanel / SpaceRail / chatPanelApi.
 * Wrappers keep the same URLs and labels; FormData / body-less POST use
 * `sendResult` so 4xx can surface in the composer instead of throwing.
 */
import { getJson, postJson, sendResult } from './client'

function httpFailure(err: any) {
  return typeof err?.status === 'number'
}

function resultError(data: any, fallback: string) {
  if (data && typeof data === 'object' && typeof data.error === 'string' && data.error) {
    return data.error
  }
  return fallback
}

export function chatAttachmentUploadUrl(channelId: any) {
  return `/api/chat/channels/${channelId}/attachments`
}

export async function fetchChatEmoji() {
  try {
    return await getJson('/api/chat/emoji', { label: 'chat/emoji' })
  } catch (err: any) {
    if (httpFailure(err)) return null
    throw err
  }
}

export async function fetchChatChannels() {
  return getJson('/api/chat/channels', { label: 'channels' })
}

export async function fetchChatMessages(channelId: any, { sinceId, signal }: LooseProps = {}) {
  const params = new URLSearchParams()
  if (sinceId) params.set('since', String(sinceId))
  const qs = params.toString()
  const url = `/api/chat/channels/${channelId}/messages${qs ? `?${qs}` : ''}`
  return getJson(url, { signal, label: 'messages' })
}

export async function postChatMessage(channelId: any, payload: any) {
  const result = await sendResult(`/api/chat/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { ...result, error: result.ok ? null : resultError(result.data, 'Send failed') }
}

export async function openChatDm(body: any) {
  const result = await sendResult('/api/chat/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { ...result, error: result.ok ? null : resultError(result.data, 'DM failed') }
}

export async function createChatChannel(payload: any) {
  const result = await sendResult('/api/chat/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { ...result, error: result.ok ? null : resultError(result.data, 'Could not create room') }
}

export async function searchChat(q: any) {
  const result = await sendResult(`/api/chat/search?q=${encodeURIComponent(q)}`)
  return { ...result, error: result.ok ? null : resultError(result.data, 'Search failed') }
}

export async function toggleChatReaction(messageId: any, emoji: any) {
  const result = await sendResult(`/api/chat/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji }),
  })
  return result
}

export async function muteChatChannel(channelId: any, muted: any) {
  const result = await sendResult(`/api/chat/channels/${channelId}/mute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted }),
  })
  return { ...result, error: result.ok ? null : resultError(result.data, 'Mute failed') }
}

export async function archiveChatChannel(channelId: any) {
  const result = await sendResult(`/api/chat/channels/${channelId}/archive`, { method: 'POST' })
  return { ...result, error: result.ok ? null : resultError(result.data, 'Archive failed') }
}

export async function leaveChatChannel(channelId: any) {
  const result = await sendResult(`/api/chat/channels/${channelId}/leave`, { method: 'POST' })
  return { ...result, error: result.ok ? null : resultError(result.data, 'Leave failed') }
}

export async function fetchChatSpaces({ signal }: LooseProps = {}) {
  return getJson('/api/chat/spaces', { signal, label: 'Could not load spaces' })
}

export async function joinChatSpace(token: any) {
  return (await postJson('/api/chat/spaces/join', { token }, { label: 'Could not join' })) ?? {}
}

/**
 * Probe whether channel attachment upload exists (OPTIONS or empty POST → 404 = off).
 * @returns {Promise<'yes'|'no'|'unknown'>}
 */
export async function probeChatAttachmentUpload(channelId: any) {
  if (!channelId) return 'unknown'
  const url = chatAttachmentUploadUrl(channelId)
  try {
    const options = await sendResult(url, { method: 'OPTIONS' })
    if (options.status === 404) return 'no'
    if (options.ok || options.status === 204 || options.status === 405) return 'yes'
  } catch {
    // Fall through to a no-body POST probe.
  }
  try {
    const result = await sendResult(url, { method: 'POST', body: new FormData() })
    if (result.status === 404 || result.status === 405) return 'no'
    if (result.status !== 404) return 'yes'
  } catch {
    return 'unknown'
  }
  return 'no'
}

/**
 * Multipart upload for chat attach. Soft-degrades on 404.
 * @returns {Promise<{ ok: boolean, unavailable?: boolean, attachment?: object, error?: string, status: number }>}
 */
export async function uploadChatAttachment(channelId: any, file: any) {
  if (!channelId || !file) {
    return { ok: false, status: 0, error: 'Missing channel or file' }
  }
  const form = new FormData()
  form.append('file', file)
  const result = await sendResult(chatAttachmentUploadUrl(channelId), {
    method: 'POST',
    body: form,
  })
  const data = result.data && typeof result.data === 'object' ? result.data : {}
  if (result.status === 404 || result.status === 405) {
    return {
      ok: false,
      unavailable: true,
      status: result.status,
      error: resultError(data, 'File attach isn’t available yet'),
    }
  }
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: resultError(data, 'Upload failed'),
    }
  }
  const attachment = data.attachment || data.file || data
  return { ok: true, status: result.status, attachment }
}

export async function createChatDmOrThrow(body: any) {
  return (await postJson('/api/chat/dm', body, { label: 'Could not open DM' })) ?? {}
}
