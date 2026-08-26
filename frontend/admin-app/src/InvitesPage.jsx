import { useEffect, useState } from 'react'
import { PageStatus } from './PageStatus'
import { DataTable } from './DataTable'
import { MetricStrip } from './opsWidgets'
import { putJson } from './adminApi'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'invite_quota', label: 'Quota', align: 'right' },
  { key: 'unused_invites', label: 'Unused tokens', align: 'right' },
]

const ROLES = ['user', 'librarian', 'child', 'admin']

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}

/**
 * Create a member directly, no email and no invite round-trip.
 *
 * The invite flow assumes the new member has an address and can be reached at
 * it. Plenty of household accounts cannot: a child's console login, the
 * living-room TV, a guest sitting next to you. For those, mailing a link to
 * nowhere is theatre — the admin wants to type a name and a password and hand
 * the person a working login.
 *
 * The account is created with an unroutable placeholder address (RFC 2606
 * `.invalid`) because `users.email` is NOT NULL and a lot of code reads it
 * without checking. It is never shown as an address anywhere.
 */
function AddMemberForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      await putJson('/admin/api/user/0', {
        username: name.trim(),
        email: '',
        password,
        role,
        state: true,
        is_email_verified: false,
      })
      setDone(`${name.trim()} can sign in now.`)
      setName('')
      setPassword('')
      onCreated?.()
    } catch (err) {
      setError(err?.message || 'Could not create that member.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="gt-admin-actions-row">
        <button type="button" className="gt-btn" onClick={() => setOpen(true)}>
          Add member without email
        </button>
      </div>
    )
  }

  return (
    <form className="gt-admin-panel" onSubmit={handleSubmit}>
      <h2>Add member without email</h2>
      <p className="gt-admin-lede">
        Creates the account straight away — no invite link and no mail server.
        Give the person the username and password yourself. They can add an
        email later from their own profile.
      </p>

      <PageStatus error={error} />
      {done ? <p role="status">{done}</p> : null}

      <label className="gt-admin-field">
        Username
        <input
          className="gt-admin-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={3}
          maxLength={64}
          required
        />
      </label>

      <label className="gt-admin-field">
        Password
        <input
          className="gt-admin-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <label className="gt-admin-field">
        Role
        <select
          className="gt-admin-input"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="gt-admin-actions-row">
        <button
          type="submit"
          className="gt-btn gt-btn--primary"
          disabled={busy || name.trim().length < 3 || password.length < 8}
        >
          {busy ? 'Creating…' : 'Create member'}
        </button>
        <button type="button" className="gt-btn" onClick={() => setOpen(false)} disabled={busy}>
          Close
        </button>
      </div>
    </form>
  )
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

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    getJson('/admin/api/invites')
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [reloadKey])

  if (error) {
    return (
      <div className="gt-admin-page">
        <PageStatus error errorMessage="Unable to load invite quotas." />
      </div>
    )
  }

  return (
    <div className="gt-admin-page">
      <h1>Invites</h1>
      <p className="gt-admin-lede">
        Per-user invite quota and unused tokens. Adjust quota on the classic form if needed.
        Members can create invites as links without an email address — see their
        Invites panel. Admins can also skip invites entirely and add a member here.
      </p>

      <AddMemberForm onCreated={() => setReloadKey((key) => key + 1)} />
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
