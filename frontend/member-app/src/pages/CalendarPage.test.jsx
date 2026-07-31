import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPage } from './CalendarPage'
import * as calendarApi from '../api/calendar'

vi.mock('../api/calendar', () => ({
  fetchCalendar: vi.fn(),
}))

beforeEach(() => {
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
