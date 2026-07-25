import { useEffect, useState } from 'react'
import { createRequest, deleteRequest, fetchRequests, resolveRequest } from '../api/wishlist'
import './WishlistPage.css'

const RESOLVE_ACTIONS = [
  { status: 'approved', label: 'Approve' },
  { status: 'rejected', label: 'Reject' },
  { status: 'fulfilled', label: 'Fulfilled' },
]

export function WishlistPage({ shellConfig = {} } = {}) {
  const isLibrarian = Boolean(shellConfig.isLibrarian ?? shellConfig.isAdmin)
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState(null)
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

  async function handleCreate(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      await createRequest({ title: trimmed, notes: notes.trim() })
      setTitle('')
      setNotes('')
      refetch()
    } catch (err) {
      setActionError(err)
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
    <div className="gt-more-page gt-wishlist">
      <div className="gt-page-header">
        <h1>Wishlist</h1>
      </div>
      <p className="gt-more-page__lede">Request titles you’d like added to the library.</p>

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
        <button type="submit" disabled={submitting}>
          Request
        </button>
      </form>

      {isLibrarian ? (
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
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !requests ? <p>Loading…</p> : null}

      {!error && requests && requests.length === 0 ? (
        <p>No requests yet. Add a title above and your librarians will take a look.</p>
      ) : null}

      {!error && requests && requests.length > 0 ? (
        <ul className="gt-wishlist__list">
          {requests.map((item) => (
            <li key={item.id} className="gt-wishlist__card" data-request-id={item.id}>
              <article>
                <strong>{item.title}</strong>
                {item.notes ? <p className="gt-wishlist__notes">{item.notes}</p> : null}
                <span className="gt-wishlist__status" data-status={item.status}>
                  {item.status}
                </span>
                {item.created_at ? (
                  <time dateTime={item.created_at}>{String(item.created_at).slice(0, 10)}</time>
                ) : null}
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
      ) : null}
    </div>
  )
}
