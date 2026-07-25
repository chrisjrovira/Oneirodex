import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FavoritesApp } from './FavoritesApp'

test('fetches favorite games and renders them with the shared grid', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        games: [
          {
            uuid: 'favorite-1',
            name: 'Favorite VR Game',
            cover_url: '/static/library/images/favorite.jpg',
            is_favorite: true,
            has_local_override: true,
            is_vr: true,
            genres: ['Adventure'],
            user_status: 'beaten',
          },
        ],
      }),
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<FavoritesApp initialConfig={{ showPlayStatus: true, isAdmin: false }} />)

  expect(screen.getByText('Loading favorites…')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText('Favorite VR Game')).toBeInTheDocument(),
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/favorites',
    expect.objectContaining({ credentials: 'same-origin' }),
  )
  expect(document.querySelectorAll('[data-library-grid]')).toHaveLength(1)
  expect(screen.getByRole('img', { name: 'Favorite VR Game' })).toHaveAttribute(
    'src',
    '/static/library/images/favorite.jpg',
  )
  expect(screen.getByTitle('Uses local metadata or images')).toBeInTheDocument()
  expect(screen.getByTitle('Virtual Reality')).toBeInTheDocument()
  expect(screen.getByLabelText('Game status: Beaten')).toBeInTheDocument()
})

test('shows an empty message when there are no favorites', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    }),
  )

  render(<FavoritesApp initialConfig={{ showPlayStatus: false, isAdmin: false }} />)

  expect(
    await screen.findByText("You haven't added any favorites yet!"),
  ).toBeInTheDocument()
})

test('removes a card after it is unfavorited', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            games: [
              {
                uuid: 'favorite-1',
                name: 'Favorite Game',
                cover_url: '/static/favorite.jpg',
                is_favorite: true,
                has_local_override: false,
                is_vr: false,
                genres: [],
                user_status: null,
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ is_favorite: false }),
      }),
  )
  render(<FavoritesApp initialConfig={{ showPlayStatus: false, isAdmin: false }} />)
  await screen.findByText('Favorite Game')

  await user.click(
    screen.getByRole('button', {
      name: 'Remove Favorite Game from favorites',
    }),
  )

  expect(
    await screen.findByText("You haven't added any favorites yet!"),
  ).toBeInTheDocument()
})
