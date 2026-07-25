import { useEffect, useState } from 'react'
import { fetchCalendar } from '../api/calendar'

export function CalendarPage() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setPayload(null)

    fetchCalendar({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setPayload(data)
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

  const releases = payload?.releases || []

  return (
    <div className="gt-more-page gt-calendar">
      <div className="gt-page-header">
        <h1>Release calendar</h1>
      </div>
      <p className="gt-more-page__lede">
        Upcoming and recent releases from IGDB (metadata only).
      </p>

      {error ? (
        <div role="alert">
          <p>Unable to load calendar.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !payload ? <p>Loading…</p> : null}

      {!error && payload ? (
        <>
          <p>{payload.count || 0} releases</p>
          {releases.length === 0 ? (
            <p>No releases in this window.</p>
          ) : (
            <ul className="gt-calendar__list">
              {releases.map((item, index) => (
                <li key={`${item.name || 'release'}-${item.first_release_date || index}`}>
                  {item.cover_url ? (
                    <img src={item.cover_url} alt="" width={60} height={80} />
                  ) : null}
                  <div>
                    <strong>{item.name || 'Untitled'}</strong>
                    <span>
                      {[item.first_release_date, item.window].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
