import { useEffect, useState } from 'react'
import { fetchCalendar } from '../api/calendar'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import './CalendarPage.css'

const AHEAD_OPTIONS = [30, 60, 90, 180]
const BEHIND_OPTIONS = [0, 7, 14, 30, 90]

function igdbHref(item) {
  if (item?.url) return item.url
  if (item?.slug) return `https://www.igdb.com/games/${encodeURIComponent(item.slug)}`
  return null
}

export function CalendarPage() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [daysAhead, setDaysAhead] = useState(60)
  const [daysBehind, setDaysBehind] = useState(14)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setPayload(null)

    fetchCalendar({
      signal: controller.signal,
      daysAhead,
      daysBehind,
      limit: 60,
    })
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
  }, [retryCount, daysAhead, daysBehind])

  const releases = Array.isArray(payload?.releases) ? payload.releases : []
  const loading = !error && !payload

  return (
    <div className="gt-more-page gt-calendar">
      <div className="gt-page-header gt-calendar__header">
        <div>
          <h1>Release calendar</h1>
          <p className="gt-more-page__lede">
            Upcoming and recent releases from IGDB (metadata only).
          </p>
        </div>
        <div className="gt-calendar__window" role="group" aria-label="Calendar window">
          <label>
            Ahead
            <select
              value={daysAhead}
              onChange={(e) => setDaysAhead(Number(e.target.value))}
              aria-label="Days ahead"
            >
              {AHEAD_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          </label>
          <label>
            Behind
            <select
              value={daysBehind}
              onChange={(e) => setDaysBehind(Number(e.target.value))}
              aria-label="Days behind"
            >
              {BEHIND_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div role="alert">
          <p>Unable to load calendar.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p>Loading…</p> : null}

      {!error && payload ? (
        <section className="gt-calendar__section" aria-labelledby="calendar-releases-heading">
          <div className="gt-calendar__section-head">
            <h2 id="calendar-releases-heading">Releases</h2>
            <span className="gt-calendar__count">{payload.count ?? releases.length}</span>
          </div>
          {releases.length === 0 ? (
            <p className="gt-calendar__empty">No releases in this window.</p>
          ) : (
            <ul className="gt-calendar__list">
              {releases.map((item, index) => {
                const href = igdbHref(item)
                const dateLabel = formatLocaleDate(item.first_release_date, { fallback: '' })
                const key = `${item.igdb_id || item.slug || item.name || 'release'}-${item.first_release_date || index}`
                return (
                  <li key={key} className="gt-calendar__row">
                    <time dateTime={item.first_release_date || undefined}>
                      {dateLabel || 'Date TBA'}
                    </time>
                    <div className="gt-calendar__body">
                      {href ? (
                        <a
                          className="gt-calendar__title-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <strong>{item.name || 'Untitled'}</strong>
                        </a>
                      ) : (
                        <strong>{item.name || 'Untitled'}</strong>
                      )}
                      {item.window ? (
                        <span className="gt-calendar__meta">{item.window}</span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
