import type { Requester } from './client.js'

/** One row of the admin roster (`GET /admin/api/users`). */
export interface AdminUserRow {
  id: number
  name?: string
  email?: string
  has_email?: boolean
  role: string
  state?: boolean
  is_email_verified?: boolean
  [key: string]: unknown
}

export interface AdminUsersResponse {
  users: AdminUserRow[]
  [key: string]: unknown
}

/** Body for `upsert` — every field optional so a role-only edit sends just that. */
export interface UpsertAdminUserRequest {
  username?: string
  email?: string
  password?: string
  role?: string
  state?: boolean
  is_email_verified?: boolean
  [key: string]: unknown
}

export interface AdminUserResult {
  ok: boolean
  error?: string | null
  [key: string]: unknown
}

/** One row of the per-user invite quota table (`GET /admin/api/invites`). */
export interface AdminInviteQuotaRow {
  user_id?: string
  id?: string
  name?: string
  role?: string
  invite_quota?: number
  unused_invites?: number
  [key: string]: unknown
}

export interface AdminInviteQuotasResponse {
  users: AdminInviteQuotaRow[]
  [key: string]: unknown
}

export function createAdminUsersApi(request: Requester) {
  return {
    /** Household roster (`GET /admin/api/users`). Admin only. */
    list(signal?: AbortSignal): Promise<AdminUsersResponse> {
      return request<AdminUsersResponse>('/admin/api/users', { signal })
    },

    /**
     * Create or update one user (`PUT /admin/api/user/{id}`). Admin only.
     * `id` of `0` (or `'0'`) creates a new user rather than editing one — the
     * same sentinel the classic form and `CreateUserForm` both use.
     */
    upsert(id: number | string, body: UpsertAdminUserRequest): Promise<AdminUserResult> {
      return request<AdminUserResult>(`/admin/api/user/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * Per-user invite quota + unused tokens (`GET /admin/api/invites`). Admin
     * only — distinct from the member-facing wishlist/invites surface.
     */
    listInviteQuotas(signal?: AbortSignal): Promise<AdminInviteQuotasResponse> {
      return request<AdminInviteQuotasResponse>('/admin/api/invites', { signal })
    },
  }
}

export type AdminUsersApi = ReturnType<typeof createAdminUsersApi>
