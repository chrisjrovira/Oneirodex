import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  window.location.hash = ''
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

  render(<NewsPage />, { wrapper: MemoryRouter })

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Welcome')).toBeInTheDocument()
  expect(screen.getByText('Hello members')).toBeInTheDocument()
  expect(screen.getByText((_, el) => el?.tagName === 'TIME' && el.getAttribute('dateTime') === '2026-07-01T12:00:00+00:00')).toBeInTheDocument()
})

test('shows empty state when no announcements', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })

  render(<NewsPage />, { wrapper: MemoryRouter })

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

  render(<NewsPage />, { wrapper: MemoryRouter })

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
  render(<NewsPage />, { wrapper: MemoryRouter })

  expect(await screen.findByText('Free Space Adventure')).toBeInTheDocument()
  expect(screen.getByText('Industry headline')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Free now' }))
  expect(screen.getByText('Free Space Adventure')).toBeInTheDocument()
  expect(screen.queryByText('Industry headline')).not.toBeInTheDocument()
  expect(screen.queryByText('No announcements yet.')).not.toBeInTheDocument()
})

test('News layout smoke: hero strip and magazine densify', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({
    announcements: [
      {
        id: 1,
        title: 'Household note',
        body: 'Servers stay up this weekend.',
        created_at: '2026-07-28T12:00:00+00:00',
      },
      {
        id: 2,
        title: 'Second note',
        body: 'Backup finished.',
        created_at: '2026-07-20T12:00:00+00:00',
      },
    ],
  })
  gamingNewsApi.fetchGamingNews.mockResolvedValue({
    items: [
      {
        url: 'https://example.test/story',
        title: 'Studio ships patch',
        summary: 'A long summary that should truncate in the magazine densify row for readability.',
        source: 'Wire',
        published_at: '2026-07-29T08:00:00+00:00',
      },
    ],
  })

  const { container } = render(<NewsPage />, { wrapper: MemoryRouter })

  expect(await screen.findByText('Household note')).toBeInTheDocument()
  expect(container.querySelector('.gt-news__hero')).toBeTruthy()
  expect(container.querySelector('.gt-news__hero-title')).toHaveTextContent('Household note')
  expect(screen.getByText('Second note')).toBeInTheDocument()
  // UX-C14: headlines are image-forward cards now, not text-only rows.
  expect(container.querySelector('.gt-news__cards')).toBeTruthy()
  expect(screen.getByText('Studio ships patch')).toBeInTheDocument()
  expect(screen.getByLabelText('News sections')).toBeInTheDocument()
})

test('headline cards show artwork when the feed supplies it', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })
  // The first headline is promoted to the hero, so a card needs a second item.
  gamingNewsApi.fetchGamingNews.mockResolvedValue({
    items: [
      { title: 'Hero story', url: 'https://example.com/hero', source: 'Example' },
      {
        title: 'Studio ships patch',
        url: 'https://example.com/a',
        source: 'Example',
        summary: 'Notes',
        image_url: 'https://cdn.example.com/art.jpg',
      },
    ],
  })
  const { container } = render(<NewsPage />, { wrapper: MemoryRouter })
  await screen.findByText('Studio ships patch')
  const art = container.querySelector('img.gt-news__card-art')
  expect(art).toBeTruthy()
  expect(art).toHaveAttribute('src', 'https://cdn.example.com/art.jpg')
})

test('a feed with no artwork gets a placeholder, never a broken frame', async () => {
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })
  gamingNewsApi.fetchGamingNews.mockResolvedValue({
    items: [
      { title: 'Hero story', url: 'https://example.com/hero', source: 'Example' },
      { title: 'No art here', url: 'https://example.com/b', source: 'Example' },
    ],
  })
  const { container } = render(<NewsPage />, { wrapper: MemoryRouter })
  await screen.findByText('No art here')
  expect(container.querySelector('.gt-news__card-art--empty')).toBeTruthy()
  expect(container.querySelector('img.gt-news__card-art')).toBeNull()
})
