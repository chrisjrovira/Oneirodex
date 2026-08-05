import { useEffect, useState } from 'react'
import { DataTable } from './DataTable'

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
      <DataTable
        columns={COLUMNS}
        rows={users}
        getRowKey={(u) => u.user_id || u.id}
        emptyMessage={loading ? 'Loading invites…' : 'No users.'}
      />
    </div>
  )
}
