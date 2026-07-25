import { useEffect, useState } from 'react'
import { fetchMyPlaytime } from '../api/playtime'

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

function formatDate(iso) {
  if (!iso) {
    return 'Never'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
      <div className="gt-page-header">
        <h1>Playtime</h1>
      </div>
      <p className="gt-more-page__lede">Your play history and time across the library.</p>

      {error ? (
        <div role="alert">
          <p>Unable to load playtime.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !data ? <p>Loading…</p> : null}

      {!error && data ? (
        <>
          <section aria-label="Playtime summary">
            <p>
              Total playtime: <strong>{formatDuration(data.total_seconds)}</strong>
            </p>
            <p>
              Games played: <strong>{games.length}</strong>
            </p>
          </section>

          {games.length === 0 ? (
            <p>No playtime recorded yet. Start a session from any game page.</p>
          ) : (
            <ul className="gt-playtime__list">
              {games.map((row) => (
                <li key={row.game_uuid}>
                  <a href={`/game_details/${row.game_uuid}`}>
                    <strong>{row.game_name || row.game_uuid}</strong>
                  </a>
                  <span>
                    {formatDuration(row.total_seconds)}
                    {' · '}
                    {row.session_count || 0} session
                    {row.session_count === 1 ? '' : 's'}
                    {' · '}
                    Last played {formatDate(row.last_played_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
