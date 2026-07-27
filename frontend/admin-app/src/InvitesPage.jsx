import { useEffect, useState } from 'react'

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

  useEffect(() => {
    getJson('/admin/api/invites')
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch((err) => setError(err))
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
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Quota</th>
            <th>Unused tokens</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id || u.id}>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{u.invite_quota}</td>
              <td>{u.unused_invites}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 ? <p>No users.</p> : null}
    </div>
  )
}
