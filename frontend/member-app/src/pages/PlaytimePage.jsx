import { useEffect, useState } from 'react'
import { fetchMyPlaytime } from '../api/playtime'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import './PlaytimePage.css'

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`
  }
  return `${s}s`
}

export function PlaytimePage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setData(null)

    fetchMyPlaytime({ signal: controller.signal })
      .then((result) => {
        if (active) {
          setData(result)
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

  const games = data?.games || []

  return (
    <div className="gt-more-page gt-playtime">
      <div className="gt-page-header gt-playtime__header">
        <div>
          <h1>Playtime</h1>
          <p className="gt-more-page__lede">Your play history and time across the library.</p>
        </div>
      </div>

      {error ? (
        <div role="alert">
          <p>Unable to load playtime.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !data ? <p className="gt-playtime__empty">Loading…</p> : null}

      {!error && data ? (
        <>
          <section className="gt-playtime__summary" aria-label="Playtime summary">
            <span>
              Total <strong>{formatDuration(data.total_seconds)}</strong>
            </span>
            <span className="gt-playtime__summary-sep" aria-hidden="true">
              ·
            </span>
            <span>
              Games <strong>{games.length}</strong>
            </span>
          </section>

          {games.length === 0 ? (
            <p className="gt-playtime__empty">
              No playtime recorded yet. Start a session from any game page.
            </p>
          ) : (
            <section aria-labelledby="playtime-games-heading">
              <div className="gt-playtime__section-head">
                <h2 id="playtime-games-heading">Games</h2>
                <span className="gt-playtime__count">{games.length}</span>
              </div>
              <ul className="gt-playtime__list">
                {games.map((row) => (
                  <li key={row.game_uuid} className="gt-playtime__row">
                    <a className="gt-playtime__title-link" href={`/game_details/${row.game_uuid}`}>
                      <strong>{row.game_name || row.game_uuid}</strong>
                    </a>
                    <span className="gt-playtime__meta">
                      {formatDuration(row.total_seconds)}
                      {' · '}
                      {row.session_count || 0} session
                      {row.session_count === 1 ? '' : 's'}
                      {' · '}
                      Last played {formatLocaleDate(row.last_played_at, { fallback: 'Never' })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}
