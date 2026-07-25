import { render, screen } from '@testing-library/react'
import { NewsPage } from './NewsPage'
import * as announcementsApi from '../api/announcements'

vi.mock('../api/announcements', () => ({
  fetchAnnouncements: vi.fn(),
}))

beforeEach(() => {
  announcementsApi.fetchAnnouncements.mockReset()
})

test('lists announcement cards from API', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({
    announcements: [
      {
        id: 1,
        title: 'Welcome',
        body: 'Hello members',
        created_at: '2026-07-01T12:00:00+00:00',
      },
    ],
  })

  render(<NewsPage />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Welcome')).toBeInTheDocument()
  expect(screen.getByText('Hello members')).toBeInTheDocument()
  expect(screen.getByText('2026-07-01')).toBeInTheDocument()
})

test('shows empty state when no announcements', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })

  render(<NewsPage />)

  expect(await screen.findByText('No announcements yet.')).toBeInTheDocument()
})
