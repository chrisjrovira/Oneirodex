import type { Requester } from './client.js'

export interface AccountSummary {
  username: string
  email: string | null
  role: string
  avatar_path: string | null
  avatar_url: string | null
  stock_avatars?: Array<{ id: string; path: string; url: string; [key: string]: unknown }>
  invite_quota: number | null
  invites_used: number
  invites_remaining: number | null
  invites_unlimited: boolean
  smtp_enabled: boolean
  [key: string]: unknown
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface AccountInvite {
  token: string
  recipient_email?: string | null
  url?: string
  [key: string]: unknown
}

export interface AccountInvitesResponse {
  invites: AccountInvite[]
  quota: number | null
  remaining: number | null
  unlimited: boolean
  smtp_enabled: boolean
  [key: string]: unknown
}

export function createAccountApi(request: Requester) {
  return {
    /** Everything the account modals show in their headers (`GET /api/account/summary`). */
    summary(signal?: AbortSignal): Promise<AccountSummary> {
      return request<AccountSummary>('/api/account/summary', { signal })
    },

    /** Change the account password (`POST /api/account/password`). */
    changePassword(body: ChangePasswordRequest): Promise<{ ok: boolean; changed: boolean }> {
      return request<{ ok: boolean; changed: boolean }>('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Pick one of the shipped avatars by id (`POST /api/account/avatar/stock`). */
    setStockAvatar(id: string): Promise<{ ok: boolean; avatar_path: string; avatar_url: string }> {
      return request('/api/account/avatar/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },

    /** List the caller's unused invites (`GET /api/account/invites`). */
    listInvites(signal?: AbortSignal): Promise<AccountInvitesResponse> {
      return request<AccountInvitesResponse>('/api/account/invites', { signal })
    },

    /** Create an invite; `email` is optional (`POST /api/account/invites`). */
    createInvite(email?: string): Promise<{ ok: boolean; invite: AccountInvite; emailed: boolean }> {
      return request('/api/account/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
    },

    /** Revoke an unused invite (`DELETE /api/account/invites/{token}`). */
    deleteInvite(token: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(
        `/api/account/invites/${encodeURIComponent(token)}`,
        { method: 'DELETE' },
      )
    },
  }
}

export type AccountApi = ReturnType<typeof createAccountApi>
