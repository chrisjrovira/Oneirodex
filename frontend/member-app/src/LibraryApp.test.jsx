import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LibraryApp } from './LibraryApp'

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

function renderLibrary(ui, { route = '/library' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

test('page flip replaces cards and does not duplicate grid roots', async () => {
  const user = userEvent.setup()
  let browseRequest = 0
  const fetchMock = vi.fn((url) => {
    if (!url.startsWith('/browse_games?')) {
      return jsonResponse([])
    }

    browseRequest += 1
    if (browseRequest === 1) {
      return jsonResponse({
        games: [{ uuid: 'a', name: 'Game A', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] }],
        pages: 2,
        current_page: 1,
        total: 2,
      })
    }

    return jsonResponse({
      games: [{ uuid: 'b', name: 'Game B', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] }],
      pages: 2,
      current_page: 2,
      total: 2,
    })
  })
  vi.stubGlobal('fetch', fetchMock)

  renderLibrary(
    <LibraryApp
      initialConfig={{
        perPage: 20,
        showPlayStatus: false,
        isAdmin: false,
        libraryCount: 1,
        gamesCount: 2,
      }}
    />,
  )

  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  await user.click(screen.getByLabelText(/^Next$/i))
  await waitFor(() => expect(screen.getByText('Game B')).toBeInTheDocument())
  expect(screen.queryByText('Game A')).toBeNull()
  expect(document.querySelectorAll('[data-library-grid]').length).toBe(1)
})

test('renders floating LHN filter column with the grid', async () => {
  const fetchMock = vi.fn((url) => {
    if (url.startsWith('/browse_games?')) {
      return jsonResponse({
        games: [],
        pages: 1,
        current_page: 1,
        total: 0,
      })
    }
    return jsonResponse([])
  })
  vi.stubGlobal('fetch', fetchMock)

  const { container } = renderLibrary(
    <LibraryApp
      initialConfig={{
        perPage: 20,
        showPlayStatus: false,
        isAdmin: false,
        libraryCount: 1,
        gamesCount: 1,
      }}
    />,
  )

  await waitFor(() =>
    expect(container.querySelector('.library-layout__filters .library-filters')).not.toBeNull(),
  )
  expect(container.querySelector('.library-layout')).not.toBeNull()
  expect(container.querySelector('.library-layout__main')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'VR' })).toBeNull()
  expect(screen.getByRole('button', { name: 'UPDATE' })).toBeInTheDocument()

  vi.unstubAllGlobals()
})

test('page change closes an open card menu before the next page loads', async () => {
  const user = userEvent.setup()
  let browseRequest = 0
  const fetchMock = vi.fn((url) => {
    if (!url.startsWith('/browse_games?')) {
      return jsonResponse([])
    }

    browseRequest += 1
    if (browseRequest === 1) {
      return jsonResponse({
        games: [{ uuid: 'a', name: 'Game A', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] }],
        pages: 2,
        current_page: 1,
        total: 2,
      })
    }

    return new Promise(() => {})
  })
  vi.stubGlobal('fetch', fetchMock)

  renderLibrary(
    <LibraryApp
      initialConfig={{
        perPage: 20,
        showPlayStatus: false,
        isAdmin: false,
        libraryCount: 1,
        gamesCount: 2,
      }}
    />,
  )

  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /open actions for game a/i }))
  expect(screen.getByRole('link', { name: 'Download' })).toBeInTheDocument()

  await user.click(screen.getByLabelText(/^Next$/i))
  expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
})

test('selection bar Select page, Favorite bulk toast, Esc clears', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((url) => {
    if (typeof url === 'string' && url.startsWith('/browse_games?')) {
      return jsonResponse({
        games: [
          {
            uuid: 'a',
            name: 'Game A',
            cover_url: '/static/x',
            is_favorite: false,
            has_local_override: false,
            is_vr: false,
            genres: [],
          },
          {
            uuid: 'b',
            name: 'Game B',
            cover_url: '/static/x',
            is_favorite: false,
            has_local_override: false,
            is_vr: false,
            genres: [],
          },
        ],
        pages: 1,
        current_page: 1,
        total: 2,
      })
    }
    if (url === '/api/games/batch/favorite') {
      return jsonResponse({
        ok: true,
        updated: [{ uuid: 'a', favorite: true }],
        skipped: [{ uuid: 'b', reason: 'already_set' }],
        errors: [],
      })
    }
    if (url === '/api/games/batch/freshness/check') {
      return jsonResponse({
        ok: true,
        updated: [{ uuid: 'a', status: 'current' }],
        skipped: [],
        errors: [],
      })
    }
    return jsonResponse([])
  })
  vi.stubGlobal('fetch', fetchMock)

  renderLibrary(
    <LibraryApp
      initialConfig={{
        perPage: 20,
        showPlayStatus: false,
        isAdmin: false,
        libraryCount: 1,
        gamesCount: 2,
      }}
    />,
  )

  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  const selectA = screen.getByRole('checkbox', { name: /select game a/i })
  await user.click(selectA)

  expect(screen.getByText('1 selected')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Select page/i }))
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Favorite$/i }))

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/games/batch/favorite',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
  await waitFor(() =>
    expect(screen.getByText(/Favorites: 1 updated · 1 skipped · 0 failed/i)).toBeInTheDocument(),
  )

  expect(screen.getByRole('button', { name: /Refresh freshness/i })).toBeEnabled()

  await user.keyboard('{Escape}')
  expect(screen.queryByText('2 selected')).toBeNull()
})
