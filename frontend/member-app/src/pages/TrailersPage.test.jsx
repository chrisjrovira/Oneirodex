import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrailersPage } from './TrailersPage'
import * as trailersApi from '../api/trailers'

vi.mock('../api/trailers', () => ({
  fetchTrailerFilters: vi.fn(),
  fetchRandomTrailer: vi.fn(),
  fetchAttractModeSettings: vi.fn(),
  saveAttractModePreferences: vi.fn(),
}))

const FILTER_OPTIONS = {
  libraries: [{ uuid: 'lib-1', name: 'Retro Shelf' }],
  genres: [{ id: 3, name: 'Shooter' }],
  themes: [{ id: 9, name: 'Horror' }],
  date_range: { min_year: 1993, max_year: 2024 },
}

beforeEach(() => {
  trailersApi.fetchTrailerFilters.mockReset()
  trailersApi.fetchRandomTrailer.mockReset()
  trailersApi.fetchAttractModeSettings.mockReset()
  trailersApi.saveAttractModePreferences.mockReset()
  trailersApi.fetchTrailerFilters.mockResolvedValue(FILTER_OPTIONS)
})

test('shows loading then renders the random trailer', async () => {
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: true,
    game_uuid: 'game-uuid-1',
    game_name: 'Doom',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
  })

  render(<TrailersPage />)

  expect(screen.getByText('Loading random trailer…')).toBeInTheDocument()

  expect(await screen.findByRole('heading', { name: 'Doom' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Doom' })).toHaveAttribute(
    'href',
    '/game_details/game-uuid-1',
  )

  const frame = screen.getByTitle('Game trailer')
  expect(frame.getAttribute('src')).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ')
  expect(screen.queryByText('Loading random trailer…')).not.toBeInTheDocument()
})

test('shows the no-results state when nothing matches', async () => {
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: false,
    message: 'No games with trailers found matching your filters',
  })

  render(<TrailersPage />)

  expect(
    await screen.findByText('No games with trailers found matching your filters'),
  ).toBeInTheDocument()
  expect(screen.queryByTitle('Game trailer')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Library' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('shows structured empty + CTA for Backend no_trailers contract', async () => {
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: false,
    empty: true,
    code: 'no_trailers',
    message: 'No trailers in your library yet.',
    cta: { id: 'library', label: 'Browse Library', href: '/library' },
  })

  render(<TrailersPage />)

  expect(await screen.findByText('No trailers in your library yet.')).toBeInTheDocument()
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse Library' })).toHaveAttribute('href', '/library')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument()
})

test('rejects a non-YouTube embed URL', async () => {
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: true,
    game_uuid: 'game-uuid-2',
    game_name: 'Sketchy',
    video_url: 'javascript:alert(1)',
  })

  render(<TrailersPage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid video URL format')
  expect(screen.queryByTitle('Game trailer')).not.toBeInTheDocument()
})

test('shows an error with retry', async () => {
  const user = userEvent.setup()
  trailersApi.fetchRandomTrailer
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce({ has_videos: false, message: 'No games with trailers found' })

  render(<TrailersPage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load trailers.')
  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText('No games with trailers found')).toBeInTheDocument()
})

test('applies selected filters when asking for another trailer', async () => {
  const user = userEvent.setup()
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: true,
    game_uuid: 'game-uuid-3',
    game_name: 'Quake',
    video_url: 'https://www.youtube.com/embed/abc12345678?autoplay=1&rel=0',
  })

  render(<TrailersPage />)

  await screen.findByRole('heading', { name: 'Quake' })

  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.selectOptions(await screen.findByLabelText('Library'), 'lib-1')
  await user.selectOptions(screen.getByLabelText('Genres'), '3')
  await user.click(screen.getByRole('button', { name: 'Another one' }))

  await waitFor(() => {
    expect(trailersApi.fetchRandomTrailer).toHaveBeenCalledTimes(2)
  })
  expect(trailersApi.fetchRandomTrailer).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filters: expect.objectContaining({ library: 'lib-1', genres: ['3'] }),
    }),
  )
})

test('new chrome keeps the playing title as content, not as a page heading', async () => {
  // The h1 here was never page identity — it names the trailer now playing and
  // links to that game. Retiring it as a "page title" would delete real
  // information, so it becomes bar two's summary and stays a link.
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: true,
    game_uuid: 'game-uuid-1',
    game_name: 'Doom',
    video_url: 'https://www.youtube.com/embed/x',
  })

  render(<TrailersPage shellConfig={{ enableNewChrome: true }} />)

  const link = await screen.findByRole('link', { name: 'Doom' })
  expect(link).toHaveAttribute('href', '/game_details/game-uuid-1')
  expect(screen.queryByRole('heading', { name: 'Doom' })).toBeNull()
})

test('new chrome keeps every playback action reachable', async () => {
  const user = userEvent.setup()
  trailersApi.fetchRandomTrailer.mockResolvedValue({
    has_videos: true,
    game_uuid: 'game-uuid-1',
    game_name: 'Doom',
    video_url: 'https://www.youtube.com/embed/x',
  })

  render(<TrailersPage shellConfig={{ enableNewChrome: true }} />)
  await screen.findByRole('link', { name: 'Doom' })

  await user.click(screen.getByRole('button', { name: 'Another one' }))
  await waitFor(() => expect(trailersApi.fetchRandomTrailer).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
})
