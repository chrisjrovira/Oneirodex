import { useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { changePassword } from '../accountApi.js'
import { messageOf } from './accountModalShared'
import { Note } from './AccountPanels'

/* PasswordPanel moved out of AccountModal (v11 cycle, H-D.2) — unchanged. */

export interface PasswordValues {
  current: string
  next: string
  confirm: string
}

export function PasswordPanel(): ReactNode {
  const [values, setValues] = useState<PasswordValues>({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  function update(key: keyof PasswordValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setValues((previous) => ({ ...previous, [key]: value }))
      setError('')
      setDone('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      await changePassword({
        current_password: values.current,
        new_password: values.next,
        confirm_password: values.confirm,
      })
      setDone('Password changed.')
      setValues({ current: '', next: '', confirm: '' })
    } catch (err) {
      setError(messageOf(err, 'Could not change your password.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Note tone="error">{error}</Note>
      <Note tone="good">{done}</Note>

      <label className="od-acct__field">
        <span className="od-acct__label">Current password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="current-password"
          value={values.current}
          onChange={update('current')}
          required
        />
      </label>

      <label className="od-acct__field">
        <span className="od-acct__label">New password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={values.next}
          onChange={update('next')}
          required
        />
      </label>

      <label className="od-acct__field">
        <span className="od-acct__label">Confirm new password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          required
        />
      </label>

      <div className="od-acct__actions">
        <button type="submit" className="od-cbtn od-cbtn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- invites */
