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

test('renders filter bar into the sidebar mount when present', async () => {
  const sidebarRoot = document.createElement('div')
  sidebarRoot.id = 'library-filters-root'
  document.body.appendChild(sidebarRoot)

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
    expect(sidebarRoot.querySelector('.library-filters')).not.toBeNull(),
  )
  expect(container.querySelector('.library-filters')).toBeNull()

  sidebarRoot.remove()
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
