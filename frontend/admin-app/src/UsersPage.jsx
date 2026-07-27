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

export function UsersPage() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getJson('/admin/api/users')
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch((err) => setError(err))
  }, [])

  if (error) {
    return (
      <div className="gt-admin-page">
        <p role="alert">Unable to load users.</p>
      </div>
    )
  }

  return (
    <div className="gt-admin-page">
      <h1>Users &amp; access</h1>
      <p className="gt-admin-lede">
        Account roster from <code>/admin/api/users</code>. Edit roles and passwords on the classic
        editor when needed.
      </p>
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
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Active</th>
            <th>Email verified</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.state ? 'yes' : 'no'}</td>
              <td>{u.is_email_verified ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 ? <p>Loading or no users.</p> : null}
    </div>
  )
}
