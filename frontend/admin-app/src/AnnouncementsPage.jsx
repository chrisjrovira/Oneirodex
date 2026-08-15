// Toasts on every mutation (GT-B25). Outcomes were reported inline only,
// which is easy to miss when the triggering control has scrolled away.
import { useEffect, useState } from 'react'
import { showToast } from './utils/toast'

async function postJson(url, body) {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || ''
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `${url} ${response.status}`)
  }
  return data
}

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`)
  }
  return response.json()
}

export function AnnouncementsPage() {
  const [rows, setRows] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [publishNow, setPublishNow] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    getJson('/api/announcements?include_drafts=1')
      .then((data) => {
        if (active) {
          setRows(Array.isArray(data.announcements) ? data.announcements : [])
        }
      })
      .catch((err) => {
        if (active) setError(err)
      })
    return () => {
      active = false
    }
  }, [tick])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await postJson('/api/announcements', {
        title,
        body,
        published: publishNow,
      })
      setTitle('')
      setBody('')
      setPublishNow(true)
      setTick((n) => n + 1)
      showToast(publishNow ? 'Announcement published.' : 'Announcement saved as draft.', 'success')
    } catch (err) {
      setError(err)
      showToast(err.message || 'Could not save the announcement.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gt-admin-page">
      <h1>Announcements</h1>
      <p className="gt-admin-lede">
        Publish blasts that appear on the member News page alongside gaming headlines. Save as draft
        to keep an unpublished note in this list.
      </p>

      {error ? <div role="alert">{String(error.message || error)}</div> : null}

      <form className="gt-admin-panel" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            className="gt-admin-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label>
          Body
          <textarea
            className="gt-admin-input"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        <label className="gt-admin-check">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
          />{' '}
          Publish immediately
        </label>
        <button className="gt-btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : publishNow ? 'Publish announcement' : 'Save draft'}
        </button>
      </form>

      <h2 style={{ marginTop: '1.5rem' }}>Recent</h2>
      {!rows ? <p>Loading…</p> : null}
      {rows && rows.length === 0 ? <p>No announcements yet.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="gt-admin-list">
          {rows.map((row) => (
            <li key={row.id} className="gt-admin-panel">
              <strong>{row.title}</strong>
              {!row.published ? <span className="chip">Draft</span> : null}
              <p>{row.body}</p>
              {row.created_at ? (
                <time dateTime={row.created_at}>{String(row.created_at).slice(0, 16)}</time>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
