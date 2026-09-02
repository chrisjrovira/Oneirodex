import { useState } from 'react'

import { putJson } from './adminApi'
import { PageStatus } from './PageStatus'

const ROLES = ['user', 'librarian', 'child', 'admin']

/**
 * Create a member directly — no invite round-trip and email optional.
 *
 * The invite flow assumes the new member can open a link and register. Plenty
 * of household accounts cannot: a child's console login, the living-room TV,
 * a guest sitting next to you. For those, the admin types a name and password
 * and hands them a working login.
 *
 * Without an email the account gets an unroutable placeholder address
 * (RFC 2606 `.invalid`) because `users.email` is NOT NULL.
 */
export function CreateUserForm({ onCreated, title = 'Create user' }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
        email: email.trim(),
        password,
        role,
        state: true,
        is_email_verified: Boolean(email.trim()),
      })
      setDone(`${name.trim()} can sign in now.`)
      setName('')
      setEmail('')
      setPassword('')
      onCreated?.()
    } catch (err) {
      setError(err?.message || 'Could not create that user.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="od-create-user">
        <button type="button" className="od-btn od-btn--primary" onClick={() => setOpen(true)}>
          {title}
        </button>
      </div>
    )
  }

  return (
    <form className="od-admin-panel" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <p className="od-admin-lede">
        Creates the account straight away — no invite link required. Give the
        person the username and password yourself. Email is optional.
      </p>

      <PageStatus error={error} />
      {done ? <p role="status">{done}</p> : null}

      <label className="od-admin-field">
        Username
        <input
          className="od-admin-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={3}
          maxLength={64}
          required
        />
      </label>

      <label className="od-admin-field">
        Email (optional)
        <input
          className="od-admin-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </label>

      <label className="od-admin-field">
        Password
        <input
          className="od-admin-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <label className="od-admin-field">
        Role
        <select
          className="od-admin-input"
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

      <div className="od-admin-actions-row">
        <button
          type="submit"
          className="od-btn od-btn--primary"
          disabled={busy || name.trim().length < 3 || password.length < 8}
        >
          {busy ? 'Creating…' : 'Create user'}
        </button>
        <button type="button" className="od-btn" onClick={() => setOpen(false)} disabled={busy}>
          Close
        </button>
      </div>
    </form>
  )
}
