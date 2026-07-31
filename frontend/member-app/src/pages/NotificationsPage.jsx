import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './NotificationsPage.css'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

const PREF_ROWS = [
  ['notify_friend_requests', 'Friend requests', 'in-app'],
  ['notify_activity', 'Activity', 'in-app'],
  ['notify_mentions', 'Mentions', 'in-app'],
  ['notify_chat', 'Direct messages', 'in-app'],
  ['notify_free_games', 'Free games', 'in-app'],
  ['email_notify_social', 'Email mentions & DMs', 'email'],
  ['email_digest_daily', 'Daily email digest', 'email'],
]

function formatWhen(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return String(value)
  }
}

export function NotificationsPage() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)

  function load() {
    return Promise.all([
      fetch('/api/notifications', { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error(`notifications ${r.status}`)
        return r.json()
      }),
      fetch('/api/notifications/preferences', { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error(`preferences ${r.status}`)
        return r.json()
      }),
    ])
      .then(([n, p]) => {
        setItems(Array.isArray(n.notifications) ? n.notifications : [])
        setUnread(Number(n.unread_count) || 0)
        setPrefs(p)
        setError(null)
      })
      .catch((err) => setError(err))
  }

  useEffect(() => {
    load()
  }, [])

  async function markAll() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ all: true }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function markOne(id) {
    if (busy || !id) return
    setBusy(true)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ ids: [id] }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function togglePref(key) {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await fetch('/api/notifications/preferences', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ [key]: next[key] }),
    })
  }

  const visible = items.filter((row) => {
    if (filter === 'unread') return Boolean(row.unread)
    return true
  })

  if (error) {
    return (
      <div className="gt-more-page gt-notifications">
        <p role="alert">Unable to load notifications.</p>
        <button type="button" className="gt-btn" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="gt-more-page gt-notifications">
      <div className="gt-page-header gt-notifications__header">
        <div>
          <h1>Notifications</h1>
          <p className="gt-more-page__lede gt-notifications__lede">
            {unread > 0 ? (
              <>
                <span className="gt-notifications__badge" aria-hidden="true">
                  {unread}
                </span>
                unread
              </>
            ) : (
              'All caught up'
            )}
          </p>
        </div>
        <div className="gt-notifications__toolbar">
          <div className="gt-notifications__filters" role="group" aria-label="Filter">
            <button
              type="button"
              className={filter === 'all' ? 'is-active' : ''}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={filter === 'unread' ? 'is-active' : ''}
              aria-pressed={filter === 'unread'}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
          </div>
          <button
            type="button"
            className="gt-btn gt-btn--ghost"
            disabled={busy || unread === 0}
            onClick={() => void markAll()}
          >
            Mark all read
          </button>
        </div>
      </div>

      {prefs ? (
        <details
          className="gt-notifications__prefs"
          open={prefsOpen}
          onToggle={(e) => setPrefsOpen(e.currentTarget.open)}
        >
          <summary>Alert preferences</summary>
          <ul className="gt-notifications__pref-list">
            {PREF_ROWS.map(([key, label, kind]) => (
              <li key={key}>
                <label className="gt-notifications__pref">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={() => void togglePref(key)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <span className="gt-notifications__pref-kind">{kind}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="gt-notifications__pref-note">Email options need SMTP configured by an admin.</p>
        </details>
      ) : null}

      <section className="gt-notifications__inbox" aria-labelledby="notifications-inbox-heading">
        <h2 className="gt-notifications__section-title" id="notifications-inbox-heading">
          Inbox
        </h2>
        {visible.length === 0 ? (
          <p className="gt-more-page__lede">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        ) : (
          <ul className="gt-notifications__list">
            {visible.map((row) => (
              <li
                key={row.id}
                className={`gt-notifications__item${row.unread ? ' is-unread' : ''}`}
              >
                <div className="gt-notifications__item-main">
                  <div className="gt-notifications__item-head">
                    {row.unread ? (
                      <span className="gt-notifications__dot" aria-label="Unread" />
                    ) : (
                      <span className="gt-notifications__dot is-read" aria-hidden="true" />
                    )}
                    <strong>{row.title}</strong>
                    {row.created_at || row.created ? (
                      <time dateTime={row.created_at || row.created}>
                        {formatWhen(row.created_at || row.created)}
                      </time>
                    ) : null}
                  </div>
                  {row.body ? <p className="gt-notifications__body">{row.body}</p> : null}
                </div>
                <div className="gt-notifications__item-actions">
                  {row.link ? (
                    String(row.link).includes('#') ? (
                      <a href={row.link}>Open</a>
                    ) : (
                      <Link to={row.link}>Open</Link>
                    )
                  ) : null}
                  {row.unread ? (
                    <button type="button" disabled={busy} onClick={() => void markOne(row.id)}>
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
