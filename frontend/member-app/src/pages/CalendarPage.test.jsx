import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CalendarPage,
  buildMonthCells,
  readCalendarView,
  writeCalendarView,
} from './CalendarPage'
import * as calendarApi from '../api/calendar'

vi.mock('../api/calendar', () => ({
  fetchCalendar: vi.fn(),
}))

const VIEW_KEY = 'gt.calendar.view'

function installLocalStorageMock() {
  const store = new Map()
  const api = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: api,
  })
  return api
}

beforeEach(() => {
  installLocalStorageMock()
  calendarApi.fetchCalendar.mockReset()
  calendarApi.fetchCalendar.mockResolvedValue({
    count: 1,
    days_ahead: 60,
    days_behind: 14,
    releases: [
      {
        igdb_id: 42,
        name: 'Example Title',
        slug: 'example-title',
        first_release_date: '2026-08-15',
        window: 'upcoming',
      },
    ],
  })
  window.localStorage.removeItem(VIEW_KEY)
})

test('lists dense release rows with date, title, and link', async () => {
  render(<CalendarPage />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Example Title')).toBeInTheDocument()
  expect(screen.getByText('upcoming')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /Example Title/i })
  expect(link).toHaveAttribute('href', 'https://www.igdb.com/games/example-title')
})

test('shows honest empty state', async () => {
  calendarApi.fetchCalendar.mockResolvedValue({ count: 0, releases: [] })
  render(<CalendarPage />)
  expect(await screen.findByText('No releases in this window.')).toBeInTheDocument()
})

test('Retry reloads after error', async () => {
  const user = userEvent.setup()
  calendarApi.fetchCalendar
    .mockRejectedValueOnce(new Error('calendar 502'))
    .mockResolvedValueOnce({ count: 0, releases: [] })

  render(<CalendarPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load calendar/i)
  await user.click(screen.getByRole('button', { name: /Retry/i }))
  expect(await screen.findByText('No releases in this window.')).toBeInTheDocument()
})

test('window controls pass days_ahead and days_behind', async () => {
  const user = userEvent.setup()
  render(<CalendarPage />)
  await screen.findByText('Example Title')

  await user.selectOptions(screen.getByLabelText('Days ahead'), '90')
  await waitFor(() => {
    expect(calendarApi.fetchCalendar).toHaveBeenLastCalledWith(
      expect.objectContaining({ daysAhead: 90, daysBehind: 14 }),
    )
  })

  await user.selectOptions(screen.getByLabelText('Days behind'), '7')
  await waitFor(() => {
    expect(calendarApi.fetchCalendar).toHaveBeenLastCalledWith(
      expect.objectContaining({ daysAhead: 90, daysBehind: 7 }),
    )
  })
})

test('view switcher persists selection in localStorage', async () => {
  const user = userEvent.setup()
  render(<CalendarPage />)
  await screen.findByText('Example Title')

  expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Month' }))
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
  expect(window.localStorage.getItem(VIEW_KEY)).toBe('month')

  // Agenda is retired (W28) — it was List with week headings, so it never
  // showed anything List did not.
  expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull()
})

test('restores persisted calendar view on mount', async () => {
  writeCalendarView('month')
  expect(readCalendarView()).toBe('month')

  render(<CalendarPage />)
  await screen.findByText('Example Title')
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
})

test('a stored agenda view falls back to List rather than selecting nothing', () => {
  // Anyone who last used Agenda has 'agenda' in localStorage. Accepting it
  // would set a view id no tab matches: no button pressed and no view rendered.
  window.localStorage.setItem(VIEW_KEY, 'agenda')
  expect(readCalendarView()).toBe('list')

  // And it must not be writable back either.
  window.localStorage.removeItem(VIEW_KEY)
  writeCalendarView('agenda')
  expect(window.localStorage.getItem(VIEW_KEY)).toBeNull()
})

test('month view renders a rotating cover tile per busy day', async () => {
  const user = userEvent.setup()
  calendarApi.fetchCalendar.mockResolvedValue({
    count: 2,
    releases: [
      {
        igdb_id: 1,
        name: 'August Drop',
        slug: 'august-drop',
        first_release_date: '2026-08-15',
        window: 'upcoming',
      },
      {
        igdb_id: 2,
        name: 'Same Day Sequel',
        slug: 'same-day-sequel',
        first_release_date: '2026-08-15',
        window: 'upcoming',
      },
    ],
  })

  render(<CalendarPage />)
  await screen.findByText('August Drop')

  await user.click(screen.getByRole('button', { name: 'Month' }))

  let guard = 0
  while (guard < 24) {
    const label = screen.getByRole('heading', { level: 3 })
    if (/August 2026/i.test(label.textContent || '')) break
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    guard += 1
  }
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/August 2026/i)

  const dayBtn = screen.getByRole('gridcell', { name: /15, 2 releases/i })
  expect(dayBtn).toHaveClass('has-releases')
  // Artwork, not dots (W28): one tile showing the first title, and a "+1"
  // saying how many more are behind it.
  expect(dayBtn.querySelectorAll('.gt-calendar__day-art')).toHaveLength(1)
  expect(dayBtn.querySelector('.gt-calendar__day-more')).toHaveTextContent('+1')
  expect(dayBtn.querySelector('.gt-calendar__day-art')).toHaveAttribute(
    'title',
    'August Drop',
  )

  await user.click(dayBtn)
  const panel = screen.getByText(/Aug/i, { selector: 'h4' }).closest('.gt-calendar__day-panel')
  expect(within(panel).getByText('August Drop')).toBeInTheDocument()
  expect(within(panel).getByText('Same Day Sequel')).toBeInTheDocument()
})

test('month view survives an empty window and explains why', async () => {
  // The regression: MonthView read `payload?.empty_reason`, which is a local of
  // CalendarPage and unbound inside MonthView — optional chaining does not
  // guard an undeclared identifier, so this threw ReferenceError and took the
  // whole page down. It fires on the first render, because with no releases
  // nothing auto-selects a day and the empty branch is what renders.
  const user = userEvent.setup()
  calendarApi.fetchCalendar.mockResolvedValue({
    count: 0,
    releases: [],
    empty_reason: 'not_configured',
  })

  render(<CalendarPage />)
  await screen.findByText(/IGDB is not set up/i)

  await user.click(screen.getByRole('button', { name: 'Month' }))

  // Rendered at all — and carrying the reason rather than the generic line,
  // which is the whole point of threading empty_reason through.
  expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  expect(screen.getAllByText(/IGDB is not set up/i).length).toBeGreaterThan(0)
})

test('buildMonthCells indexes markers by date key', () => {
  const byDate = new Map([
    ['2026-08-15', [{ name: 'A' }, { name: 'B' }]],
    ['2026-08-01', [{ name: 'C' }]],
  ])
  const cells = buildMonthCells(2026, 7, byDate)
  const day15 = cells.find((c) => c.inMonth && c.day === 15)
  const day1 = cells.find((c) => c.inMonth && c.day === 1)
  expect(day15?.releases).toHaveLength(2)
  expect(day1?.releases).toHaveLength(1)
})

test('new chrome moves views to bar two and the window into a popover', async () => {
  const user = userEvent.setup()
  calendarApi.fetchCalendar.mockResolvedValue({ releases: [] })
  render(<CalendarPage shellConfig={{ enableNewChrome: true }} />)
  await screen.findByText('No releases in this window.')

  expect(screen.queryByRole('heading', { name: 'Release calendar' })).toBeNull()
  // The window is two selects worth of state that would otherwise be invisible
  // once collapsed, so bar two states it in the open.
  expect(screen.getByText('14 back / 60 ahead')).toBeInTheDocument()

  const trigger = screen.getByRole('button', { name: /Filters/ })
  expect(trigger).not.toHaveClass('is-on')

  await user.click(trigger)
  await user.selectOptions(screen.getByLabelText('Days ahead'), '180')

  await waitFor(() => expect(screen.getByText('14 back / 180 ahead')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /Filters/ })).toHaveClass('is-on')
})
