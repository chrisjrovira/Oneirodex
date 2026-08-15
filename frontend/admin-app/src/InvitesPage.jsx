import { useEffect, useState } from 'react'
import { DataTable } from './DataTable'
import { MetricStrip } from './opsWidgets'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'invite_quota', label: 'Quota', align: 'right' },
  { key: 'unused_invites', label: 'Unused tokens', align: 'right' },
]

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}

export function InvitesPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Summed with Number() and a zero default: the API omits the field for
  // users who have never had a quota, and `undefined` would poison the total
  // into NaN rather than simply not adding to it.
  const unusedTotal = users.reduce((n, u) => n + (Number(u.unused_invites) || 0), 0)
  const quotaTotal = users.reduce((n, u) => n + (Number(u.invite_quota) || 0), 0)

  useEffect(() => {
    getJson('/admin/api/invites')
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div className="gt-admin-page">
        <p role="alert">Unable to load invite quotas.</p>
      </div>
    )
  }

  return (
    <div className="gt-admin-page">
      <h1>Invites</h1>
      <p className="gt-admin-lede">
        Per-user invite quota and unused tokens. Adjust quota on the classic form if needed.
      </p>
      <div className="gt-admin-actions-row">
        <a className="gt-btn" href="/admin/manage_invites">
          Classic invite editor
        </a>
        <a className="gt-btn" href="/admin/users">
          Users
        </a>
        <a className="gt-btn" href="/admin/support">
          Support inbox
        </a>
      </div>
      {/* UID-014. "Unused tokens" is the number that decides whether anyone
          can actually invite someone, so it carries the tone: zero across the
          household means invites are effectively closed, which the table alone
          does not say out loud. */}
      <MetricStrip
        label="Invites"
        items={[
          { id: 'members', label: 'Members', value: users.length, hint: 'with a quota', tone: 'info' },
          {
            id: 'unused',
            label: 'Unused tokens',
            value: unusedTotal,
            hint: 'invites available now',
            tone: unusedTotal === 0 ? 'warning' : 'good',
          },
          { id: 'quota', label: 'Total quota', value: quotaTotal, hint: 'allocated', tone: 'info' },
        ]}
      />
      <DataTable
        columns={COLUMNS}
        rows={users}
        getRowKey={(u) => u.user_id || u.id}
        emptyMessage={loading ? 'Loading invites…' : 'No users.'}
      />
    </div>
  )
}
