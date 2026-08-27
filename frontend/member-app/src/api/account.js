import { csrfHeaders, getCsrfToken } from './csrf'
import { errorFromResponse } from './envelopeError'

/**
 * Self-service account calls behind the account modals.
 *
 * Every one of these had a server-rendered page instead, which meant leaving
 * whatever you were doing to change an avatar and coming back to a fresh
 * scroll position. The pages remain as the no-JS fallback; these are what the
 * modals use.
 */

/**
 * @returns {Promise<{
 *   username: string,
 *   email: string,
 *   role: string,
 *   avatar_path: string,
 *   invite_quota: number,
 *   invites_used: number,
 *   invites_remaining: number,
 *   smtp_enabled: boolean,
 * }>}
 */
export async function getAccountSummary({ signal } = {}) {
  const response = await fetch('/api/account/summary', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Load account')
  }
  return response.json()
}

/**
 * Multipart, so the CSRF token rides as a form field as well as a header —
 * `fetch` must not be given a Content-Type here or the boundary is lost.
 *
 * @param {File} file
 * @returns {Promise<{ avatar_path: string, avatar_url: string }>}
 */
export async function uploadAvatar(file) {
  const body = new FormData()
  body.append('avatar', file)
  const token = getCsrfToken()
  if (token) {
    body.append('csrf_token', token)
  }

  const response = await fetch('/api/account/avatar', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
    body,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Upload avatar')
  }
  return response.json()
}

/**
 * Pick one of the avatars Oneirodex ships. Takes the id, never a path.
 *
 * @param {string} id
 * @returns {Promise<{ avatar_path: string, avatar_url: string }>}
 */
export async function chooseStockAvatar(id) {
  const response = await fetch('/api/account/avatar/stock', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id }),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Choose avatar')
  }
  return response.json()
}

/**
 * @param {{ current_password: string, new_password: string, confirm_password: string }} body
 * @returns {Promise<{ changed: boolean }>}
 */
export async function changePassword(body) {
  const response = await fetch('/api/account/password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Change password')
  }
  return response.json()
}

/**
 * @returns {Promise<{
 *   invites: Array<{ token: string, email: string|null, url: string, expires_at: string|null, expired: boolean }>,
 *   quota: number,
 *   remaining: number,
 *   smtp_enabled: boolean,
 *   ttl_hours: number,
 *   site_url_configured: boolean,
 * }>}
 */
export async function listInvites({ signal } = {}) {
  const response = await fetch('/api/account/invites', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'List invites')
  }
  return response.json()
}

/**
 * `email` is optional. Without one the invite is still created and its URL
 * comes back for the inviter to pass on however they like.
 *
 * @param {{ email?: string }} [body]
 */
export async function createInvite(body = {}) {
  const response = await fetch('/api/account/invites', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Create invite')
  }
  return response.json()
}

/** @param {string} token */
export async function revokeInvite(token) {
  const response = await fetch(`/api/account/invites/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Revoke invite')
  }
  return response.json()
}
