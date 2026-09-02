import { useEffect, useMemo, useState } from 'react'
import { fetchCalendar } from '../api/calendar'
import { ContextBar } from '../chrome/ContextBar'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import { PageStatus } from '../components/PageStatus'
import './CalendarPage.css'

const AHEAD_OPTIONS = [30, 60, 90, 180]
const BEHIND_OPTIONS = [0, 7, 14, 30, 90]
// The window the page opens with. Bar two badges the popover only when the
// window has been changed from these, so an untouched page shows no count.
const DEFAULT_AHEAD = 60
const DEFAULT_BEHIND = 14
const VIEW_STORAGE_KEY = 'gt.calendar.view'
// Agenda is gone (W28). It was List grouped by week — the same rows, the same
// order, one extra heading between them — so it was a third tab that answered
// a question List already answered. Month is the only view that shows the data
// differently, and it now carries artwork rather than dots.
const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'month', label: 'Month' },
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function readCalendarView() {
  try {
    const raw = window.localStorage?.getItem(VIEW_STORAGE_KEY)
    // A stored 'agenda' from before the view was retired falls through to
              // the default rather than selecting a tab that no longer exists.
              if (raw === 'list' || raw === 'month') return raw
  } catch {
    /* ignore */
  }
  return 'list'
}

export function writeCalendarView(view) {
  try {
    if (view === 'list' || view === 'month') {
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
      <a className="od-calendar__title-link" href={href} target="_blank" rel="noreferrer">
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
  return <span className="od-calendar__meta">{item.window}</span>
}

function ListView({ releases, emptyReason }) {
  if (releases.length === 0) {
    return <p className="od-calendar__empty">{calendarEmptyMessage(emptyReason)}</p>
  }
  return (
    <ul className="od-calendar__list">
      {releases.map((item, index) => {
        const dateLabel = formatLocaleDate(item.first_release_date, { fallback: '' })
        return (
          <li key={releaseKey(item, index)} className="od-calendar__row">
            <time dateTime={item.first_release_date || undefined}>
              {dateLabel || 'Date TBA'}
            </time>
            <div className="od-calendar__body">
              <ReleaseTitle item={item} />
              <ReleaseMeta item={item} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The artwork for one day's cell (W28).
 *
 * Busy days used to auto-rotate a single cover. That made the art too small to
 * read and hid every title but one. The cell now stacks every cover in a
 * scrollable column so you can scrub the day's games in place; the side panel
 * still lists the full titles for the selected day.
 */
function DayArt({ releases }) {
  return (
    <span className="od-calendar__day-stack">
      {releases.map((item, index) => {
        const cover = item?.cover_url
        const key = `${item?.igdb_id || item?.slug || item?.name || 'release'}-${index}`
        return (
          <span
            key={key}
            className="od-calendar__day-art"
            title={item?.name || undefined}
          >
            {cover ? (
              <img
                className="od-calendar__day-cover"
                src={cover}
                alt=""
                loading="lazy"
              />
            ) : (
              <span
                className="od-calendar__day-cover od-calendar__day-cover--blank"
                aria-hidden="true"
              >
                {(item?.name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

function MonthView({ releases, focusYear, focusMonth, onFocusChange, emptyReason }) {
  const byDate = useMemo(() => indexByDate(releases), [releases])
  const cells = useMemo(
    () => buildMonthCells(focusYear, focusMonth, byDate),
    [focusYear, focusMonth, byDate],
  )
  const [selectedKey, setSelectedKey] = useState(null)

  // Today, hoisted out of the effect below.
  // It was computed there and thrown away, so the one date every calendar marks
  // was the one date this one did not — on a month with no releases there was
  // nothing at all to say where in the year you were standing.
  const todayKey = toDateKey(new Date())

  useEffect(() => {
    const withReleases = cells.filter((c) => c.inMonth && c.releases.length > 0)
    const preferToday = withReleases.find((c) => c.dateKey === todayKey)
    setSelectedKey(preferToday?.dateKey || withReleases[0]?.dateKey || null)
  }, [focusYear, focusMonth, cells, todayKey])

  const selected = cells.find((c) => c.dateKey === selectedKey && c.inMonth)
  const selectedReleases = selected?.releases || []

  return (
    <div className="od-calendar__month">
      <div className="od-calendar__month-nav">
        <button
          type="button"
          className="od-calendar__nav-btn"
          aria-label="Previous month"
          onClick={() => {
            const prev = new Date(focusYear, focusMonth - 1, 1, 12)
            onFocusChange(prev.getFullYear(), prev.getMonth())
          }}
        >
          ‹
        </button>
        <h3 className="od-calendar__month-label">{monthLabel(focusYear, focusMonth)}</h3>
        <button
          type="button"
          className="od-calendar__nav-btn"
          aria-label="Next month"
          onClick={() => {
            const next = new Date(focusYear, focusMonth + 1, 1, 12)
            onFocusChange(next.getFullYear(), next.getMonth())
          }}
        >
          ›
        </button>
      </div>

      <div className="od-calendar__grid" role="grid" aria-label="Release month">
        <div className="od-calendar__weekday-row" role="row">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="od-calendar__weekday" role="columnheader">
              {label}
            </div>
          ))}
        </div>
        <div className="od-calendar__day-grid" role="rowgroup">
          {cells.map((cell) => {
            const count = cell.releases.length
            const isSelected = cell.inMonth && cell.dateKey === selectedKey
            const isToday = cell.inMonth && cell.dateKey === todayKey
            return (
              <button
                key={`${cell.dateKey}-${cell.inMonth ? 'in' : 'out'}`}
                type="button"
                role="gridcell"
                className={[
                  'od-calendar__day',
                  cell.inMonth ? '' : 'is-out',
                  count ? 'has-releases' : '',
                  isSelected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!cell.inMonth}
                aria-label={
                  cell.inMonth
                    ? `${cell.day}${isToday ? ', today' : ''}${
                        count ? `, ${count} release${count === 1 ? '' : 's'}` : ''
                      }`
                    : undefined
                }
                aria-pressed={isSelected}
                onClick={() => {
                  if (cell.inMonth) setSelectedKey(cell.dateKey)
                }}
              >
                <span className="od-calendar__day-num">{cell.day}</span>
                {count > 0 ? <DayArt releases={cell.releases} /> : null}
                {/* How busy the day is, stated. The artwork alone says "there
                    is something here"; a day with nine releases and a day with
                    one looked identical until you clicked it. From two up only
                    — a "1" on every single-release day is noise. */}
                {count > 1 ? (
                  <span className="od-calendar__day-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="od-calendar__day-panel" aria-live="polite">
        {selected ? (
          <>
            <h4 className="od-calendar__day-panel-title">
              {formatLocaleDate(selected.dateKey, { fallback: selected.dateKey })}
            </h4>
            {selectedReleases.length === 0 ? (
              <p className="od-calendar__empty">No releases on this day.</p>
            ) : (
              <ul className="od-calendar__day-list">
                {selectedReleases.map((item, index) => (
                  <li key={releaseKey(item, index)} className="od-calendar__day-item">
                    <ReleaseTitle item={item} />
                    <ReleaseMeta item={item} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="od-calendar__empty">
            {releases.length === 0
              ? calendarEmptyMessage(emptyReason)
              : 'Select a day with a marker to see titles.'}
          </p>
        )}
      </div>
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
            <div className="od-calendar__window" role="group" aria-label="Calendar window">
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
    <div
      className="od-more-page od-calendar od-calendar--fill"
      data-view={view}
    >
      {useNewChrome ? null : (
        <div className="od-page-header od-calendar__header">
          <div>
            <h1>Release calendar</h1>
            <p className="od-more-page__lede">
              Upcoming and recent releases from IGDB (metadata only).
            </p>
          </div>
          <div className="od-calendar__controls">
            <div className="od-calendar__views" role="group" aria-label="Calendar view">
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
            <div className="od-calendar__window" role="group" aria-label="Calendar window">
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

      <PageStatus
        loading={loading}
        error={error}
        errorMessage="Unable to load calendar."
        loadingMessage="Loading calendar…"
        onRetry={() => setRetryCount((n) => n + 1)}
      />

      {!error && payload ? (
        <section className="od-calendar__section" aria-labelledby="calendar-releases-heading">
          <div className="od-calendar__section-head">
            <h2 id="calendar-releases-heading">Releases</h2>
            <span className="od-calendar__count">{payload.count ?? releases.length}</span>
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
        </section>
      ) : null}
    </div>
    </>
  )
}
