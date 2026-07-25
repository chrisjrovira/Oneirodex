import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BigPicturePage } from './BigPicturePage'
import * as browseApi from '../api/browse'

vi.mock('../api/browse', () => ({
  fetchBrowseGames: vi.fn(),
}))

beforeEach(() => {
  browseApi.fetchBrowseGames.mockReset()
})

const GAMES = [
  {
    uuid: 'a1',
    name: 'Alpha Game',
    cover_url: 'covers/alpha.jpg',
    summary: 'An alpha adventure.',
    size: '4.2 GB',
    owned: true,
  },
  {
    uuid: 'b2',
    name: 'Beta Game',
    cover_url: null,
    summary: 'A beta romp.',
  },
]

test('shows loading then renders tiles and hero for the first game', async () => {
  browseApi.fetchBrowseGames.mockResolvedValue({ games: GAMES })

  render(<BigPicturePage shellConfig={{}} />)

  expect(screen.getByText('Loading games…')).toBeInTheDocument()

  const alphaTile = await screen.findByRole('option', { name: 'Alpha Game' })
  expect(alphaTile).toHaveAttribute('href', '/game_details/a1')
  expect(alphaTile).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('option', { name: 'Beta Game' })).toHaveAttribute(
    'href',
    '/game_details/b2',
  )

  expect(browseApi.fetchBrowseGames).toHaveBeenCalledWith(
    { per_page: 24, sort_by: 'date_identified', sort_order: 'desc' },
    expect.objectContaining({ signal: expect.anything() }),
  )

  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Alpha Game')
  expect(screen.getByText('An alpha adventure.')).toBeInTheDocument()
  expect(screen.getByText('OWNED · 4.2 GB')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
    'href',
    '/game_details/a1',
  )
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/download_game/a1',
  )
})

test('arrow keys move the selection and update the hero', async () => {
  const user = userEvent.setup()
  browseApi.fetchBrowseGames.mockResolvedValue({ games: GAMES })

  render(<BigPicturePage shellConfig={{}} />)

  const alphaTile = await screen.findByRole('option', { name: 'Alpha Game' })
  expect(alphaTile).toHaveFocus()

  await user.keyboard('{ArrowRight}')

  const betaTile = screen.getByRole('option', { name: 'Beta Game' })
  expect(betaTile).toHaveAttribute('aria-selected', 'true')
  expect(betaTile).toHaveFocus()
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Beta Game')
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
    'href',
    '/game_details/b2',
  )

  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('option', { name: 'Alpha Game' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('shows empty state when the library has no games', async () => {
  browseApi.fetchBrowseGames.mockResolvedValue({ games: [] })

  render(<BigPicturePage shellConfig={{}} />)

  expect(await screen.findByText('No games in your library yet.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No games')
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument()
})

test('shows an error with retry that recovers', async () => {
  const user = userEvent.setup()
  browseApi.fetchBrowseGames
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce({ games: GAMES })

  render(<BigPicturePage shellConfig={{}} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load Big Picture.')

  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByRole('option', { name: 'Alpha Game' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
