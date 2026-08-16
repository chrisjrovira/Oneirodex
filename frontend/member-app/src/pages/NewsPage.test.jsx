import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

test('the admin section stays off the combined view when there is nothing in it', async () => {
  // `announcements` is an array, so the old `announcements &&` was true when
  // empty and rendered a heading, a zero count and "No announcements yet." —
  // a permanent empty panel holding a column beside the two sections that
  // always have content.
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })

  render(<NewsPage />, { wrapper: MemoryRouter })

  expect(await screen.findByRole('heading', { name: 'Free now' })).toBeInTheDocument()
  expect(screen.queryByText('No announcements yet.')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'From your admins' })).not.toBeInTheDocument()
})

test('the admin tab still says so when there are no announcements', async () => {
  // On its own tab the section *is* the page, so silence would read as a
  // failed load rather than an empty one.
  announcementsApi.fetchAnnouncements.mockResolvedValue({ announcements: [] })

  render(<NewsPage />, { wrapper: MemoryRouter })

  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /Admins/ }))

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

test('new chrome puts the sections in bar two with live counts', async () => {
  const user = userEvent.setup()
  announcementsApi.fetchAnnouncements.mockResolvedValue({
    announcements: [
      { id: 1, title: 'Welcome', body: 'Hi', created_at: '2026-07-01T12:00:00+00:00' },
    ],
  })
  gamingNewsApi.fetchGamingNews.mockResolvedValue({
    items: [{ title: 'Studio ships patch', url: 'https://example.com/a', source: 'Example' }],
  })

  render(<NewsPage shellConfig={{ enableNewChrome: true }} />, { wrapper: MemoryRouter })
  await screen.findByText('Welcome')

  // The h1 is gone; the sections it sat above are now the switcher.
  expect(screen.queryByRole('heading', { name: 'News' })).toBeNull()
  const headlines = screen.getByRole('button', { name: /Headlines/ })
  expect(headlines).toHaveTextContent('1')

  await user.click(headlines)
  expect(screen.getByText('Studio ships patch')).toBeInTheDocument()
  expect(screen.queryByText('Welcome')).toBeNull()
})

test('section counts stay hidden until the feeds have actually answered', async () => {
  // A "0" beside Free now would read as "there is nothing free" when the truth
  // is that the request has not come back.
  announcementsApi.fetchAnnouncements.mockReturnValue(new Promise(() => {}))
  render(<NewsPage shellConfig={{ enableNewChrome: true }} />, { wrapper: MemoryRouter })

  expect(screen.getByRole('button', { name: /Free now/ }).textContent).not.toMatch(/\d/)
})
