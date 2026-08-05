import { useCallback, useEffect, useState } from 'react'
import { DataTable } from './DataTable'
import { MetricStrip } from './opsWidgets'

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}

/** Roster counts for the metric strip (GT-C2). Pure so it can be tested directly. */
export function summarizeUsers(users) {
  const rows = Array.isArray(users) ? users : []
  const admins = rows.filter((u) => u.role === 'admin').length
  const inactive = rows.filter((u) => !u.state).length
  const unverified = rows.filter((u) => !u.is_email_verified).length
  return { total: rows.length, admins, inactive, unverified }
}

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  // Distinct from "empty" on purpose — the old copy said "Loading or no users",
  // which left an admin unable to tell a slow request from an empty household.
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getJson('/admin/api/users')
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = summarizeUsers(users)

  return (
    <div className="gt-admin-page">
      <h1>Users &amp; access</h1>
      <p className="gt-admin-lede">
        Account roster from <code>/admin/api/users</code>. Edit roles and passwords on the classic
        editor when needed.
      </p>

      {error ? (
        <div className="gt-error" role="alert">
          <div className="gt-error__message">
            Unable to load users.
            <p className="gt-error__detail">{String(error.message || error)}</p>
          </div>
          <button type="button" className="gt-btn gt-btn--sm" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {!error && !loading ? (
        <MetricStrip
          label="Roster"
          items={[
            { id: 'total', label: 'Accounts', value: counts.total, hint: 'in household', tone: 'info' },
            { id: 'admins', label: 'Admins', value: counts.admins, hint: 'full access', tone: 'info' },
            {
              id: 'inactive',
              label: 'Inactive',
              value: counts.inactive,
              hint: 'cannot sign in',
              tone: counts.inactive > 0 ? 'warning' : 'good',
            },
            {
              id: 'unverified',
              label: 'Unverified',
              value: counts.unverified,
              hint: 'email pending',
              tone: counts.unverified > 0 ? 'warning' : 'good',
            },
          ]}
        />
      ) : null}

      <div className="gt-admin-actions-row">
        <a className="gt-btn" href="/admin/manage_users">
          Classic user editor
        </a>
        <a className="gt-btn" href="/admin/invites">
          Invites
        </a>
        <a className="gt-btn" href="/admin/manage_invites">
          Invite quotas
        </a>
        <a className="gt-btn" href="/admin/support">
          Support inbox
        </a>
      </div>

      {loading ? (
        <p role="status" aria-busy="true">
          Loading accounts…
        </p>
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <p className="gt-empty">No accounts yet. Invite someone to get started.</p>
      ) : null}

      {users.length > 0 ? (
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            // Sort/filter on the word shown, so typing "yes" filters as expected.
            { key: 'state', label: 'Active', value: (u) => (u.state ? 'yes' : 'no') },
            {
              key: 'is_email_verified',
              label: 'Email verified',
              value: (u) => (u.is_email_verified ? 'yes' : 'no'),
            },
          ]}
          rows={users}
          getRowKey={(u) => u.id}
          emptyMessage="No accounts yet."
        />
      ) : null}
    </div>
  )
}
