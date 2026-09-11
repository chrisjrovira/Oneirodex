import { csrfHeaders } from './csrf.js'
import { errorFromResponse } from './envelopeError.js'

/**
 * Self-service account calls behind the account modals.
 *
 * Every one of these had a server-rendered page instead, which meant leaving
 * whatever you were doing to change an avatar and coming back to a fresh
 * scroll position. The pages remain as the no-JS fallback; these are what the
 * modals use.
 */

/** One of the avatars Oneirodex ships, as `GET /api/account/summary` lists them. */
export interface StockAvatar {
  id: string
  path: string
  url: string
  label: string
}

/** `GET /api/account/summary` payload. */
export interface AccountSummary {
  username: string
  email: string
  role: string
  avatar_path: string
  /** Theme-resolved URL for the current avatar; preferred over `avatar_path`. */
  avatar_url?: string
  stock_avatars?: StockAvatar[]
  invite_quota: number
  invites_used: number
  invites_remaining: number
  smtp_enabled: boolean
  [key: string]: unknown
}

/** Result of an avatar change — upload or stock pick. */
export interface AvatarChangeResponse {
  avatar_path: string
  avatar_url: string
}

/** Body for `POST /api/account/password`. */
export interface ChangePasswordBody {
  current_password: string
  new_password: string
  confirm_password: string
}

/** One outstanding invite as `GET /api/account/invites` lists it. */
export interface AccountInvite {
  token: string
  email: string | null
  url: string
  expires_at: string | null
  expired: boolean
}

/** `GET /api/account/invites` payload. */
export interface ListInvitesResponse {
  invites: AccountInvite[]
  quota: number
  remaining: number
  smtp_enabled: boolean
  ttl_hours: number
  site_url_configured: boolean
  /** True when the account has no invite ceiling; hides the "N of M left" copy. */
  unlimited?: boolean
}

/** Body for `POST /api/account/invites`. `email` is optional. */
export interface CreateInviteBody {
  email?: string
}

/** `POST /api/account/invites` payload. */
export interface CreateInviteResponse {
  invite?: AccountInvite
  /** True when the server sent the invite by mail rather than only minting a link. */
  emailed?: boolean
  [key: string]: unknown
}

export async function getAccountSummary({
  signal,
}: { signal?: AbortSignal } = {}): Promise<AccountSummary> {
  const response = await fetch('/api/account/summary', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Load account')
  }
  return response.json() as Promise<AccountSummary>
}

/**
 * Pick one of the avatars Oneirodex ships. Takes the id, never a path.
 */
export async function chooseStockAvatar(id: string): Promise<AvatarChangeResponse> {
  const response = await fetch('/api/account/avatar/stock', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id }),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Choose avatar')
  }
  return response.json() as Promise<AvatarChangeResponse>
}

export async function changePassword(body: ChangePasswordBody): Promise<{ changed: boolean }> {
  const response = await fetch('/api/account/password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Change password')
  }
  return response.json() as Promise<{ changed: boolean }>
}

export async function listInvites({
  signal,
}: { signal?: AbortSignal } = {}): Promise<ListInvitesResponse> {
  const response = await fetch('/api/account/invites', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'List invites')
  }
  return response.json() as Promise<ListInvitesResponse>
}

/**
 * `email` is optional. Without one the invite is still created and its URL
 * comes back for the inviter to pass on however they like.
 */
export async function createInvite(body: CreateInviteBody = {}): Promise<CreateInviteResponse> {
  const response = await fetch('/api/account/invites', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Create invite')
  }
  return response.json() as Promise<CreateInviteResponse>
}

export async function revokeInvite(token: string): Promise<unknown> {
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
