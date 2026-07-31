import { render, screen } from '@testing-library/react'
import { NewsPage } from './NewsPage'
import * as announcementsApi from '../api/announcements'
import * as freeGamesApi from '../api/freeGames'
import * as gamingNewsApi from '../api/gamingNews'

vi.mock('../api/announcements', () => ({
  fetchAnnouncements: vi.fn(),
}))

vi.mock('../api/freeGames', () => ({
  fetchFreeGames: vi.fn(),
  claimFreeGameAssist: vi.fn(),
}))

vi.mock('../api/gamingNews', () => ({
  fetchGamingNews: vi.fn(),
}))

beforeEach(() => {
  announcementsApi.fetchAnnouncements.mockReset()
  freeGamesApi.fetchFreeGames.mockReset()
  freeGamesApi.claimFreeGameAssist.mockReset()
  gamingNewsApi.fetchGamingNews.mockReset()
  freeGamesApi.fetchFreeGames.mockResolvedValue({ items: [] })
  gamingNewsApi.fetchGamingNews.mockResolvedValue({ items: [] })
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
  expect(screen.getByText((_, el) => el?.tagName === 'TIME' && el.getAttribute('dateTime') === '2026-07-01T12:00:00+00:00')).toBeInTheDocument()
})

test('shows empty state when no announcements', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })

  render(<NewsPage />)

  expect(await screen.findByText('No announcements yet.')).toBeInTheDocument()
})

test('keeps announcements when gaming news fails', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({
    announcements: [
      {
        id: 2,
        title: 'Maintenance',
        body: 'Tonight',
        created_at: '2026-07-02T12:00:00+00:00',
      },
    ],
  })
  gamingNewsApi.fetchGamingNews.mockRejectedValue(new Error('rss down'))

  render(<NewsPage />)

  expect(await screen.findByText('Maintenance')).toBeInTheDocument()
  expect(screen.queryByText('Unable to load news.')).not.toBeInTheDocument()
  expect(screen.getByText('No external headlines available right now.')).toBeInTheDocument()
})

test('section tabs filter free offers without a long scroll dump', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })
  freeGamesApi.fetchFreeGames.mockResolvedValue({
    items: [
      {
        id: 9,
        store: 'steam',
        external_id: 'abc',
        title: 'Free Space Adventure',
        description: 'Grab it while it lasts',
        links: { https: 'https://example.test/claim' },
        connected: false,
      },
    ],
  })
  gamingNewsApi.fetchGamingNews.mockResolvedValue({
    items: [{ url: 'https://example.test/h1', title: 'Industry headline', source: 'Wire' }],
  })

  const { default: userEvent } = await import('@testing-library/user-event')
  const user = userEvent.setup()
  render(<NewsPage />)

  expect(await screen.findByText('Free Space Adventure')).toBeInTheDocument()
  expect(screen.getByText('Industry headline')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Free now' }))
  expect(screen.getByText('Free Space Adventure')).toBeInTheDocument()
  expect(screen.queryByText('Industry headline')).not.toBeInTheDocument()
  expect(screen.queryByText('No announcements yet.')).not.toBeInTheDocument()
})
