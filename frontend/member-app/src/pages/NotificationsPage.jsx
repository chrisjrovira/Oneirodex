import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContextBar } from '../chrome/ContextBar'
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
  ['share_activity', 'Let friends see what I am playing', 'privacy'],
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

/* Inbox and Archive, not All and Unread.
 *
 * "All" mixed what still needs you with what you have already dealt with, and
 * the pile only ever grew — reading a notification changed a dot and nothing
 * else. Reading it now *files* it: the inbox holds what is outstanding, and
 * everything you have seen stays available under Archive rather than being
 * deleted or buried. */
const NOTIFICATION_VIEWS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'archive', label: 'Archive' },
]

export function NotificationsPage({ shellConfig = {} }) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [filter, setFilter] = useState('inbox')
  const [busy, setBusy] = useState(false)

  /**
   * Fetch the rows for the view being shown.
   *
   * The Inbox is defined as "unread", so it has to be *asked for* as unread.
   * Filtering the default page client-side meant that a member with forty read
   * notifications newer than their one unread item saw an empty Inbox while
   * the bar beside it said "1 unread" — the notification was unreachable. The
   * server already supports the filter; Archive takes a deeper page because it
   * is history and the read rows are the bulk of it.
   */
  function load(view = filter) {
    const query = view === 'inbox' ? '?unread=1&limit=100' : '?limit=100'
    return Promise.all([
      fetch(`/api/notifications${query}`, { credentials: 'same-origin' }).then((r) => {
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
    load(filter)
    // Refetch on switch: Inbox and Archive are different server queries, not
    // two filters over one page of rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

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
    // Archive is everything already read; the inbox is what is left.
    if (filter === 'archive') return !row.unread
    if (filter === 'inbox') return Boolean(row.unread)
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
    <>
    {useNewChrome ? (
        <ContextBar
          views={NOTIFICATION_VIEWS}
          activeView={filter}
          onSelectView={setFilter}
          summary={unread > 0 ? `${unread} unread` : 'All caught up'}
        />
      ) : null}
    <div className="gt-more-page gt-notifications">
      {useNewChrome ? null : (
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
              {NOTIFICATION_VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={filter === id ? 'is-active' : ''}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Mark all read moved to the Inbox heading row for both chromes —
                one control in one place, beside the list it acts on. */}
          </div>
        </div>
      )}

      {prefs ? (
        <details
          className="gt-notifications__prefs"
          open={prefsOpen}
          onToggle={(e) => setPrefsOpen(e.currentTarget.open)}
        >
          <summary>Preferences</summary>
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
          <p className="gt-notifications__pref-note">
            Email options need SMTP configured by an admin. Activity sharing is
            limited to accepted friends and is never server-wide.
          </p>
        </details>
      ) : null}

      <section className="gt-notifications__inbox" aria-labelledby="notifications-inbox-heading">
        {/* Mark all read sits on the Inbox heading row, not in the top bar
            (W28). It acts on the list directly below it, and the bar is where
            controls that act on the *page* live — so up there it was a long
            reach from the thing it changes, and it was the only page action in
            the bar competing with the view segments. On the heading row it
            reads as part of the list it empties. */}
        <div className="gt-notifications__inbox-head">
          <h2 className="gt-notifications__section-title" id="notifications-inbox-heading">
            Inbox
          </h2>
          <button
            type="button"
            className="gt-btn gt-btn--ghost gt-btn--sm gt-notifications__mark-all"
            disabled={busy || unread === 0}
            onClick={() => void markAll()}
          >
            Mark all read
          </button>
        </div>
        {visible.length === 0 ? (
          <p className="gt-more-page__lede">
            {filter === 'archive'
              ? 'Nothing archived yet — notifications land here once you have read them.'
              : 'All caught up.'}
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
    </>
  )
}
