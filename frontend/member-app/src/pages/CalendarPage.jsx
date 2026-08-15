import { useEffect, useMemo, useState } from 'react'
import { fetchCalendar } from '../api/calendar'
import { ContextBar } from '../chrome/ContextBar'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import './CalendarPage.css'

const AHEAD_OPTIONS = [30, 60, 90, 180]
const BEHIND_OPTIONS = [0, 7, 14, 30, 90]
// The window the page opens with. Bar two badges the popover only when the
// window has been changed from these, so an untouched page shows no count.
const DEFAULT_AHEAD = 60
const DEFAULT_BEHIND = 14
const VIEW_STORAGE_KEY = 'gt.calendar.view'
const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'month', label: 'Month' },
  { id: 'agenda', label: 'Agenda' },
]
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function readCalendarView() {
  try {
    const raw = window.localStorage?.getItem(VIEW_STORAGE_KEY)
    if (raw === 'list' || raw === 'month' || raw === 'agenda') return raw
  } catch {
    /* ignore */
  }
  return 'list'
}

export function writeCalendarView(view) {
  try {
    if (view === 'list' || view === 'month' || view === 'agenda') {
      window.localStorage?.setItem(VIEW_STORAGE_KEY, view)
    }
  } catch {
    /* ignore */
  }
}

function igdbHref(item) {
  if (item?.url) return item.url
  if (item?.slug) return `https://www.igdb.com/games/${encodeURIComponent(item.slug)}`
  return null
}

function releaseKey(item, index) {
  return `${item.igdb_id || item.slug || item.name || 'release'}-${item.first_release_date || index}`
}

/** Parse YYYY-MM-DD (or ISO) to a noon-local Date; invalid → null. */
export function parseReleaseDate(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      12,
      0,
      0,
    )
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1, 12).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** Build a 6×7 month grid; each cell is { dateKey, day, inMonth, releases }. */
export function buildMonthCells(year, monthIndex, byDate) {
  const first = new Date(year, monthIndex, 1, 12)
  const startOffset = first.getDay()
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(year, monthIndex, 1 - startOffset + i, 12)
    const dateKey = toDateKey(date)
    const inMonth = date.getMonth() === monthIndex
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth,
      releases: dateKey && byDate.has(dateKey) ? byDate.get(dateKey) : [],
    })
  }
  return cells
}

/** Group releases into week buckets (week starts Sunday). */
export function groupReleasesByWeek(releases) {
  const buckets = new Map()
  for (const item of releases) {
    const date = parseReleaseDate(item.first_release_date)
    if (!date) {
      const key = 'tba'
      if (!buckets.has(key)) {
        buckets.set(key, { key, label: 'Date TBA', sort: Number.POSITIVE_INFINITY, items: [] })
      }
      buckets.get(key).items.push(item)
      continue
    }
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    weekStart.setHours(12, 0, 0, 0)
    const key = toDateKey(weekStart)
    if (!buckets.has(key)) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      const label = `${formatLocaleDate(weekStart, { fallback: key })} – ${formatLocaleDate(weekEnd, { fallback: '' })}`
      buckets.set(key, { key, label: `Week of ${label}`, sort: weekStart.getTime(), items: [] })
    }
    buckets.get(key).items.push(item)
  }
  return [...buckets.values()].sort((a, b) => a.sort - b.sort)
}

function indexByDate(releases) {
  const map = new Map()
  for (const item of releases) {
    const date = parseReleaseDate(item.first_release_date)
    const key = toDateKey(date)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return map
}

function ReleaseTitle({ item }) {
  const href = igdbHref(item)
  if (href) {
    return (
      <a className="gt-calendar__title-link" href={href} target="_blank" rel="noreferrer">
        <strong>{item.name || 'Untitled'}</strong>
      </a>
    )
  }
  return <strong>{item.name || 'Untitled'}</strong>
}

/**
 * Why the calendar is empty, in words (W27).
 *
 * The API returns HTTP 200 with an empty list whether IGDB is unconfigured,
 * the call failed, or nothing genuinely releases in the window — so the page
 * showed the same blank panel for all three and left you to guess. It now
 * carries `empty_reason`, and this turns it into something actionable.
 */
export function calendarEmptyMessage(reason) {
  if (reason === 'not_configured') {
    return 'No release data — IGDB is not set up. Add IGDB credentials under Admin → Integrations to fill this calendar.'
  }
  if (reason === 'unavailable') {
    return 'Could not reach IGDB just now. The calendar will fill in once it responds.'
  }
  return 'No releases in this window.'
}

function ReleaseMeta({ item }) {
  if (!item.window) return null
  return <span className="gt-calendar__meta">{item.window}</span>
}

function ListView({ releases, emptyReason }) {
  if (releases.length === 0) {
    return <p className="gt-calendar__empty">{calendarEmptyMessage(emptyReason)}</p>
  }
  return (
    <ul className="gt-calendar__list">
      {releases.map((item, index) => {
        const dateLabel = formatLocaleDate(item.first_release_date, { fallback: '' })
        return (
          <li key={releaseKey(item, index)} className="gt-calendar__row">
            <time dateTime={item.first_release_date || undefined}>
              {dateLabel || 'Date TBA'}
            </time>
            <div className="gt-calendar__body">
              <ReleaseTitle item={item} />
              <ReleaseMeta item={item} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MonthView({ releases, focusYear, focusMonth, onFocusChange, emptyReason }) {
  const byDate = useMemo(() => indexByDate(releases), [releases])
  const cells = useMemo(
    () => buildMonthCells(focusYear, focusMonth, byDate),
    [focusYear, focusMonth, byDate],
  )
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    const todayKey = toDateKey(new Date())
    const withReleases = cells.filter((c) => c.inMonth && c.releases.length > 0)
    const preferToday = withReleases.find((c) => c.dateKey === todayKey)
    setSelectedKey(preferToday?.dateKey || withReleases[0]?.dateKey || null)
  }, [focusYear, focusMonth, cells])

  const selected = cells.find((c) => c.dateKey === selectedKey && c.inMonth)
  const selectedReleases = selected?.releases || []

  return (
    <div className="gt-calendar__month">
      <div className="gt-calendar__month-nav">
        <button
          type="button"
          className="gt-calendar__nav-btn"
          aria-label="Previous month"
          onClick={() => {
            const prev = new Date(focusYear, focusMonth - 1, 1, 12)
            onFocusChange(prev.getFullYear(), prev.getMonth())
          }}
        >
          ‹
        </button>
        <h3 className="gt-calendar__month-label">{monthLabel(focusYear, focusMonth)}</h3>
        <button
          type="button"
          className="gt-calendar__nav-btn"
          aria-label="Next month"
          onClick={() => {
            const next = new Date(focusYear, focusMonth + 1, 1, 12)
            onFocusChange(next.getFullYear(), next.getMonth())
          }}
        >
          ›
        </button>
      </div>

      <div className="gt-calendar__grid" role="grid" aria-label="Release month">
        <div className="gt-calendar__weekday-row" role="row">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="gt-calendar__weekday" role="columnheader">
              {label}
            </div>
          ))}
        </div>
        <div className="gt-calendar__day-grid" role="rowgroup">
          {cells.map((cell) => {
            const count = cell.releases.length
            const isSelected = cell.inMonth && cell.dateKey === selectedKey
            return (
              <button
                key={`${cell.dateKey}-${cell.inMonth ? 'in' : 'out'}`}
                type="button"
                role="gridcell"
                className={[
                  'gt-calendar__day',
                  cell.inMonth ? '' : 'is-out',
                  count ? 'has-releases' : '',
                  isSelected ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!cell.inMonth}
                aria-label={
                  cell.inMonth
                    ? `${cell.day}${count ? `, ${count} release${count === 1 ? '' : 's'}` : ''}`
                    : undefined
                }
                aria-pressed={isSelected}
                onClick={() => {
                  if (cell.inMonth) setSelectedKey(cell.dateKey)
                }}
              >
                <span className="gt-calendar__day-num">{cell.day}</span>
                {count > 0 ? (
                  <span className="gt-calendar__markers" aria-hidden="true">
                    {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                      <span key={i} className="gt-calendar__dot" />
                    ))}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="gt-calendar__day-panel" aria-live="polite">
        {selected ? (
          <>
            <h4 className="gt-calendar__day-panel-title">
              {formatLocaleDate(selected.dateKey, { fallback: selected.dateKey })}
            </h4>
            {selectedReleases.length === 0 ? (
              <p className="gt-calendar__empty">No releases on this day.</p>
            ) : (
              <ul className="gt-calendar__day-list">
                {selectedReleases.map((item, index) => (
                  <li key={releaseKey(item, index)} className="gt-calendar__day-item">
                    <ReleaseTitle item={item} />
                    <ReleaseMeta item={item} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="gt-calendar__empty">
            {releases.length === 0
              ? calendarEmptyMessage(emptyReason)
              : 'Select a day with a marker to see titles.'}
          </p>
        )}
      </div>
    </div>
  )
}

function AgendaView({ releases }) {
  const weeks = useMemo(() => groupReleasesByWeek(releases), [releases])

  if (releases.length === 0) {
    return <p className="gt-calendar__empty">No releases in this window.</p>
  }

  return (
    <div className="gt-calendar__agenda">
      {weeks.map((week) => (
        <section key={week.key} className="gt-calendar__agenda-week" aria-labelledby={`agenda-${week.key}`}>
          <h3 id={`agenda-${week.key}`} className="gt-calendar__agenda-label">
            {week.label}
          </h3>
          <ul className="gt-calendar__agenda-list">
            {week.items.map((item, index) => {
              const dateLabel = formatLocaleDate(item.first_release_date, { fallback: '' })
              return (
                <li key={releaseKey(item, index)} className="gt-calendar__agenda-row">
                  <time dateTime={item.first_release_date || undefined}>
                    {dateLabel || 'Date TBA'}
                  </time>
                  <div className="gt-calendar__body">
                    <ReleaseTitle item={item} />
                    <ReleaseMeta item={item} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function CalendarPage({ shellConfig = {} }) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [daysAhead, setDaysAhead] = useState(DEFAULT_AHEAD)
  const [daysBehind, setDaysBehind] = useState(DEFAULT_BEHIND)
  const [view, setView] = useState(() => readCalendarView())
  const now = new Date()
  const [focusYear, setFocusYear] = useState(now.getFullYear())
  const [focusMonth, setFocusMonth] = useState(now.getMonth())

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

  function selectView(next) {
    setView(next)
    writeCalendarView(next)
  }

  const windowIsDefault = daysAhead === DEFAULT_AHEAD && daysBehind === DEFAULT_BEHIND

  return (
    <>
    {useNewChrome ? (
        <ContextBar
          views={VIEWS}
          activeView={view}
          onSelectView={selectView}
          summary={`${daysBehind} back / ${daysAhead} ahead`}
          filters={
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
          }
          filterCount={windowIsDefault ? 0 : 1}
        />
      ) : null}
    <div className="gt-more-page gt-calendar">
      {useNewChrome ? null : (
        <div className="gt-page-header gt-calendar__header">
          <div>
            <h1>Release calendar</h1>
            <p className="gt-more-page__lede">
              Upcoming and recent releases from IGDB (metadata only).
            </p>
          </div>
          <div className="gt-calendar__controls">
            <div className="gt-calendar__views" role="group" aria-label="Calendar view">
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={view === id ? 'is-active' : ''}
                  aria-pressed={view === id}
                  onClick={() => selectView(id)}
                >
                  {label}
                </button>
              ))}
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
        </div>
      )}

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
          {view === 'list' ? (
            <ListView releases={releases} emptyReason={payload?.empty_reason} />
          ) : null}
          {view === 'month' ? (
            <MonthView
              releases={releases}
              emptyReason={payload?.empty_reason}
              focusYear={focusYear}
              focusMonth={focusMonth}
              onFocusChange={(y, m) => {
                setFocusYear(y)
                setFocusMonth(m)
              }}
            />
          ) : null}
          {view === 'agenda' ? <AgendaView releases={releases} /> : null}
        </section>
      ) : null}
    </div>
    </>
  )
}
