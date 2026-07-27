import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export function NotificationsPage() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    return Promise.all([
      fetch('/api/notifications', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/notifications/preferences', { credentials: 'same-origin' }).then((r) => r.json()),
    ])
      .then(([n, p]) => {
        setItems(Array.isArray(n.notifications) ? n.notifications : [])
        setUnread(Number(n.unread_count) || 0)
        setPrefs(p)
      })
      .catch((err) => setError(err))
  }

  useEffect(() => {
    load()
  }, [])

  async function markAll() {
    await fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ all: true }),
    })
    await load()
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await fetch('/api/notifications/preferences', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ [key]: next[key] }),
    })
  }

  if (error) {
    return (
      <div className="gt-more-page">
        <p role="alert">Unable to load notifications.</p>
      </div>
    )
  }

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Notifications</h1>
      </div>
      <p className="gt-more-page__lede">{unread} unread</p>
      <p>
        <button type="button" className="gt-btn" onClick={() => void markAll()}>
          Mark all read
        </button>
      </p>
      {prefs ? (
        <section>
          <h2>Preferences</h2>
          <ul>
            {[
              ['notify_friend_requests', 'Friend requests'],
              ['notify_activity', 'Activity'],
              ['notify_mentions', 'Mentions'],
              ['notify_chat', 'Direct messages'],
              ['notify_free_games', 'Free games'],
              ['email_notify_social', 'Email me for mentions & DMs (needs SMTP)'],
              ['email_digest_daily', 'Daily email digest — mentions, DMs, free games (needs SMTP)'],
            ].map(([key, label]) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={() => void togglePref(key)}
                  />{' '}
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2>Inbox</h2>
        {items.length === 0 ? (
          <p className="gt-more-page__lede">No notifications yet.</p>
        ) : (
          <ul>
            {items.map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong>
                {row.unread ? ' · new' : ''}
                {row.body ? <div>{row.body}</div> : null}
                {row.link ? (
                  <div>
                    {String(row.link).includes('#') ? (
                      <a href={row.link}>Open</a>
                    ) : (
                      <Link to={row.link}>Open</Link>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
