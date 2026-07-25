import { useEffect, useState } from 'react'
import { fetchUpdatesInbox } from '../api/updates'

export function UpdatesPage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setItems(null)

    fetchUpdatesInbox({ signal: controller.signal, limit: 100 })
      .then((data) => {
        if (active) {
          setItems(Array.isArray(data.items) ? data.items : [])
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
  }, [retryCount])

  return (
    <div className="gt-more-page gt-updates">
      <div className="gt-page-header">
        <h1>Updates</h1>
      </div>
      <p className="gt-more-page__lede">
        Games that look behind current store versions (OUT / ~).
      </p>

      {error ? (
        <div role="alert">
          <p>Unable to load updates.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !items ? <p>Loading…</p> : null}

      {!error && items && items.length === 0 ? (
        <p>No outdated titles detected. Nice.</p>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="gt-updates__list">
          {items.map((game) => (
            <li key={game.uuid}>
              <a href={`/game_details/${game.uuid}`}>
                <strong>{game.name}</strong>
                <span>
                  {[
                    game.freshness_status,
                    `${game.local_version || 'local?'} → ${game.remote_version_summary || 'store?'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
