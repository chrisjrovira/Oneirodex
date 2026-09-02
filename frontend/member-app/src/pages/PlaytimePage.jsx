import { useEffect, useState } from 'react'
import { fetchMyPlaytime } from '../api/playtime'
import { ContextBar } from '../chrome/ContextBar'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import { PageStatus } from '../components/PageStatus'
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

export function PlaytimePage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
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
  const gameCountLabel =
    games.length === 1 ? '1 game' : `${games.length} games`

  return (
    <>
      {useNewChrome ? (
        <ContextBar
          summary={data ? `${formatDuration(data.total_seconds)} · ${gameCountLabel}` : null}
        />
      ) : null}
      <div className="od-more-page od-playtime">
        {useNewChrome ? null : (
          <div className="od-page-header od-playtime__header">
            <div>
              <h1>Playtime</h1>
              <p className="od-more-page__lede">Your play history and time across the library.</p>
            </div>
          </div>
        )}

        <PageStatus
          loading={!error && !data}
          error={error}
          errorMessage="Unable to load playtime."
          loadingMessage="Loading playtime…"
          onRetry={() => setRetryCount((n) => n + 1)}
        />

        {!error && data ? (
          <>
            {useNewChrome ? null : (
              <section className="od-playtime__summary" aria-label="Playtime summary">
                <span>
                  Total <strong>{formatDuration(data.total_seconds)}</strong>
                </span>
                <span className="od-playtime__summary-sep" aria-hidden="true">
                  ·
                </span>
                <span>
                  Games <strong>{games.length}</strong>
                </span>
              </section>
            )}

            {games.length === 0 ? (
              <p className="od-playtime__empty">
                No playtime recorded yet. Start a session from any game page.
              </p>
            ) : (
              <section aria-labelledby="playtime-games-heading">
                <div className="od-playtime__section-head">
                  <h2 id="playtime-games-heading">Games</h2>
                  <span className="od-playtime__count">{games.length}</span>
                </div>
                <ul className="od-playtime__list">
                  {games.map((row) => (
                    <li key={row.game_uuid} className="od-playtime__row">
                      <a className="od-playtime__title-link" href={`/game_details/${row.game_uuid}`}>
                        <strong>{row.game_name || row.game_uuid}</strong>
                      </a>
                      <span className="od-playtime__meta">
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
    </>
  )
}
