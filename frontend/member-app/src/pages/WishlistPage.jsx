import { useEffect, useState } from 'react'
import { createRequest, deleteRequest, fetchRequests, resolveRequest } from '../api/wishlist'
import { ContextBar, Popover } from '../chrome/ContextBar'
import { RailIcon } from '../chrome/railIcons'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import './WishlistPage.css'

const RESOLVE_ACTIONS = [
  { status: 'approved', label: 'Approve' },
  { status: 'rejected', label: 'Reject' },
  { status: 'fulfilled', label: 'Fulfilled' },
]

export function WishlistPage({ shellConfig = {} } = {}) {
  const isLibrarian = Boolean(shellConfig.isLibrarian ?? shellConfig.isAdmin)
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState(null)
  // Separate from actionError on purpose: the create form lives inside a
  // popover and shows its own failure there, while approve / reject / cancel
  // fail against a row in the list. One state for both meant a failed request
  // painted an alert in two places at once.
  const [createError, setCreateError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const all = isLibrarian && showAll

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setRequests(null)

    fetchRequests({ all, signal: controller.signal })
      .then((data) => {
        if (active) {
          setRequests(Array.isArray(data.requests) ? data.requests : [])
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadCount, all])

  function refetch() {
    setReloadCount((n) => n + 1)
  }

  /**
   * @param {SubmitEvent} event
   * @param {() => void} [onDone] closes the popover, but only on success —
   *   dismissing the panel on a failed submit would take the error message
   *   with it, and the field the member has to correct.
   */
  async function handleCreate(event, onDone) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    setSubmitting(true)
    setCreateError(null)
    try {
      await createRequest({ title: trimmed, notes: notes.trim() })
      setTitle('')
      setNotes('')
      refetch()
      onDone?.()
    } catch (err) {
      setCreateError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id) {
    setBusyId(id)
    setActionError(null)
    try {
      await deleteRequest(id)
      refetch()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusyId(null)
    }
  }

  async function handleResolve(id, status) {
    setBusyId(id)
    setActionError(null)
    try {
      await resolveRequest(id, { status })
      refetch()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
    {useNewChrome ? (
        <ContextBar
          summary={requests ? `${requests.length} requests` : null}
          actions={
            <>
              {isLibrarian ? (
                <button
                  type="button"
                  className={`gt-cbtn${showAll ? ' is-on' : ''}`}
                  aria-pressed={showAll}
                  onClick={() => setShowAll((value) => !value)}
                >
                  Everyone’s requests
                </button>
              ) : null}
              <Popover
                label="Request a title"
                icon={<RailIcon name="wishlist" size={16} />}
              >
              {({ close }) => (
              <form
                className="gt-wishlist__form"
                onSubmit={(event) => handleCreate(event, close)}
              >
                <label htmlFor="gt-wishlist-title">Title</label>
                <input
                  id="gt-wishlist-title"
                  type="text"
                  maxLength={255}
                  required
                  placeholder="Game title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <label htmlFor="gt-wishlist-notes">Notes</label>
                <input
                  id="gt-wishlist-notes"
                  type="text"
                  maxLength={400}
                  placeholder="Optional details"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                {createError ? (
                  <p className="gt-wishlist__action-error" role="alert">
                    {createError.message}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="gt-cbtn gt-cbtn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Requesting…' : 'Request'}
                </button>
              </form>
              )}
              </Popover>
            </>
          }
        />
      ) : null}
    <div className="gt-more-page gt-wishlist">
      {useNewChrome ? null : (
        <>
        <div className="gt-page-header gt-wishlist__header">
          <div>
            <h1>Wishlist</h1>
            <p className="gt-more-page__lede">Request titles you’d like added to the library.</p>
          </div>
        </div>

        <form className="gt-wishlist__form" onSubmit={handleCreate}>
          <label htmlFor="gt-wishlist-title">Title</label>
          <input
            id="gt-wishlist-title"
            type="text"
            maxLength={255}
            required
            placeholder="Game title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="gt-wishlist-notes">Notes</label>
          <input
            id="gt-wishlist-notes"
            type="text"
            maxLength={400}
            placeholder="Optional details"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <button type="submit" className="gt-btn" disabled={submitting}>
            {submitting ? 'Requesting…' : 'Request'}
          </button>
          {createError ? (
            <p className="gt-wishlist__action-error" role="alert">
              {createError.message}
            </p>
          ) : null}
        </form>
        </>
      )}

      {isLibrarian && !useNewChrome ? (
        <label className="gt-wishlist__toggle">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Show everyone’s requests
        </label>
      ) : null}

      {actionError ? (
        <p className="gt-wishlist__action-error" role="alert">
          {actionError.message}
        </p>
      ) : null}

      {error ? (
        <div role="alert">
          <p>Unable to load wishlist.</p>
          <button type="button" className="gt-btn" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !requests ? <p className="gt-wishlist__empty">Loading…</p> : null}

      {!error && requests && requests.length === 0 ? (
        <p className="gt-wishlist__empty">
          {useNewChrome
            ? 'No requests yet. Use Request a title above and your librarians will take a look.'
            : 'No requests yet. Add a title above and your librarians will take a look.'}
        </p>
      ) : null}

      {!error && requests && requests.length > 0 ? (
        <section aria-labelledby="wishlist-requests-heading">
          <div className="gt-wishlist__section-head">
            <h2 id="wishlist-requests-heading">Requests</h2>
            <span className="gt-wishlist__count">{requests.length}</span>
          </div>
          <ul className="gt-wishlist__list">
            {requests.map((item) => (
              <li key={item.id} className="gt-wishlist__row" data-request-id={item.id}>
                <article>
                  <div className="gt-wishlist__row-head">
                    <strong>{item.title}</strong>
                    <span className="gt-wishlist__status" data-status={item.status}>
                      {item.status}
                    </span>
                    {item.created_at ? (
                      <time dateTime={item.created_at}>{formatLocaleDate(item.created_at)}</time>
                    ) : null}
                  </div>
                  {item.notes ? <p className="gt-wishlist__notes">{item.notes}</p> : null}
                  {item.linked_game_uuid ? (
                    <a href={`/game_details/${item.linked_game_uuid}`}>Open game</a>
                  ) : null}
                  <div className="gt-wishlist__actions">
                    {isLibrarian
                      ? RESOLVE_ACTIONS.map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleResolve(item.id, action.status)}
                          >
                            {action.label}
                          </button>
                        ))
                      : null}
                    {isLibrarian || item.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleCancel(item.id)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
    </>
  )
}
