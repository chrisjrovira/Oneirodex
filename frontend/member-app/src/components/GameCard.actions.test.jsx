import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameCard } from './GameCard'

const game = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Archery Kings VR',
  cover_url: '/static/newstyle/default_cover.jpg',
  is_favorite: false,
  user_status: null,
  has_local_override: false,
  is_vr: false,
  genres: ['Sports'],
}

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('favorite toggle posts with CSRF and updates the card', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(() => jsonResponse({ success: true, is_favorite: true }))
  vi.stubGlobal('fetch', fetchMock)

  render(<GameCard game={game} />)
  const favorite = screen.getByRole('button', { name: /add archery kings vr to favorites/i })
  await user.click(favorite)

  await waitFor(() => expect(favorite).toHaveAttribute('aria-pressed', 'true'))
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/toggle_favorite/${game.uuid}`,
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-CSRFToken': 'test-csrf',
      }),
    }),
  )
})

test('status selection posts with CSRF and updates the status button', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn(() =>
    jsonResponse({ success: true, status: 'completed', message: 'Status updated' }),
  )
  vi.stubGlobal('fetch', fetchMock)

  render(<GameCard game={game} showPlayStatus />)
  await user.click(screen.getByRole('button', { name: /game status: no status/i }))
  await user.click(screen.getByRole('button', { name: 'Completed' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /game status: completed/i })).toBeInTheDocument(),
  )
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/set_game_status/${game.uuid}`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ status: 'completed' }),
      headers: expect.objectContaining({ 'X-CSRFToken': 'test-csrf' }),
    }),
  )
})

test('popup exposes navigation actions and gates admin actions', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<GameCard game={game} isAdmin={false} />)

  await user.click(screen.getByRole('button', { name: /open actions for archery kings vr/i }))
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Edit Details' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Remove Game from DB' })).toBeNull()
  await user.click(screen.getByRole('button', { name: /open actions for archery kings vr/i }))

  rerender(
    <GameCard
      game={game}
      isAdmin
      enableDeleteOnDisk
    />,
  )
  await user.click(screen.getByRole('button', { name: /open actions for archery kings vr/i }))
  expect(screen.getByRole('link', { name: 'Edit Details' })).toHaveAttribute(
    'href',
    `/game_edit/${game.uuid}`,
  )
  expect(screen.getByRole('link', { name: 'Edit Images' })).toHaveAttribute(
    'href',
    `/edit_game_images/${game.uuid}`,
  )
  expect(screen.getByRole('button', { name: 'Refresh Images' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove Game from DB' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Game on disk' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Move Library' })).toBeInTheDocument()
})

test('popup ignores javascript: IGDB urls', async () => {
  const user = userEvent.setup()
  render(
    <GameCard
      game={{ ...game, url: 'javascript:alert(1)' }}
      isAdmin={false}
    />,
  )
  await user.click(screen.getByRole('button', { name: /open actions for archery kings vr/i }))
  expect(screen.queryByRole('link', { name: 'Open catalog page' })).toBeNull()
})
