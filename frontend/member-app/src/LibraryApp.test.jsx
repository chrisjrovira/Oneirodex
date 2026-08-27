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

test('filters fall back in place when no rail slot exists', async () => {
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

  // No rail in this tree, so the filters take the in-place fallback rather
  // than disappearing — that fallback is the contract being asserted here.
  await waitFor(() =>
    expect(container.querySelector('.library-layout__filters .library-filters')).not.toBeNull(),
  )
  expect(container.querySelector('.library-layout')).not.toBeNull()
  expect(container.querySelector('.library-layout__main')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'VR' })).toBeNull()
  expect(screen.getByRole('button', { name: 'UPDATE' })).toBeInTheDocument()

  vi.unstubAllGlobals()
})

test('filters render into the rail slot when the shell provides one', async () => {
  // The second left-hand panel is gone (GT-B4): filters portal into
  // #gt-rail-slot under the Library destination. The old behaviour under test
  // here — a collapse tab toggling .is-filters-collapsed and persisting
  // gt.library.filtersVisible — belonged to that panel and went with it.
  const slot = document.createElement('div')
  slot.id = 'gt-rail-slot'
  document.body.appendChild(slot)

  const fetchMock = vi.fn((url) => {
    if (url.startsWith('/browse_games?')) {
      return jsonResponse({ games: [], pages: 1, current_page: 1, total: 0 })
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

  await waitFor(() => expect(slot.querySelector('.library-filters')).not.toBeNull())
  // …and not also in place, or we would be back to two filter panels.
  expect(container.querySelector('.library-layout__filters')).toBeNull()

  slot.remove()
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
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()

  await user.click(screen.getByLabelText(/^Next$/i))
  expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
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

test('live title search sends name browse param after debounce', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((url) => {
    if (url.startsWith('/browse_games?')) {
      return jsonResponse({
        games: [
          {
            uuid: 'a',
            name: 'Celeste',
            cover_url: '/static/x',
            is_favorite: false,
            has_local_override: false,
            is_vr: false,
            genres: [],
          },
        ],
        pages: 1,
        current_page: 1,
        total: 1,
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
        gamesCount: 1,
      }}
    />,
  )

  await waitFor(() => expect(screen.getByText('Celeste')).toBeInTheDocument())

  const input = screen.getByRole('searchbox', { name: /search library by title/i })
  await user.type(input, 'cel')

  await waitFor(
    () => {
      const named = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.startsWith('/browse_games?'))
        .some((url) => {
          const qs = new URL(url, 'http://local').searchParams
          return qs.get('name') === 'cel'
        })
      expect(named).toBe(true)
    },
    { timeout: 2500 },
  )

  vi.unstubAllGlobals()
})

/* UIR-2 — the two-bar chrome. Kept behind shellConfig.enableNewChrome so the
   old layout stays the default until every page has adopted it. */

function renderNewChrome({ total = 3 } = {}) {
  const fetchMock = vi.fn((url) => {
    if (!String(url).startsWith('/browse_games?')) return jsonResponse([])
    return jsonResponse({
      games: [
        { uuid: 'a', name: 'Game A', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] },
      ],
      pages: 1,
      current_page: 1,
      total,
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return renderLibrary(
    <LibraryApp
      initialConfig={{ perPage: 20, showPlayStatus: false, isAdmin: false, libraryCount: 1, gamesCount: total }}
      shellConfig={{ enableNewChrome: true }}
    />,
  )
}

test('new chrome retires the filter rail and its collapse tab', async () => {
  const { container } = renderNewChrome()
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  // The whole point: no aside, so the grid owns the full width.
  expect(container.querySelector('.library-layout__filters')).toBeNull()
  expect(container.querySelector('.library-filters-collapse')).toBeNull()
  expect(container.querySelector('.library-layout.is-chrome-v2')).not.toBeNull()
})

test('new chrome renders no page heading', async () => {
  const { container } = renderNewChrome()
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  expect(container.querySelector('h1')).toBeNull()
})

test('filters are still reachable, inside the popover', async () => {
  const user = userEvent.setup()
  renderNewChrome()
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())

  // Closed by default — the grid is what you came for.
  expect(screen.queryByLabelText(/Search by title/i)).toBeNull()
  await user.click(screen.getByRole('button', { name: /Filters/ }))
  await waitFor(() =>
    expect(screen.getByRole('dialog', { name: /Filters/ })).toBeInTheDocument(),
  )
})

test('kind is a segmented control, not duplicated in the panel', async () => {
  const user = userEvent.setup()
  renderNewChrome()
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())

  // One "All" segment in the bar…
  const seg = document.querySelector('.gt-seg')
  expect(seg).not.toBeNull()
  expect(seg.textContent).toMatch(/All/)

  // …and the popover must not render a second Kind control for the same filter.
  await user.click(screen.getByRole('button', { name: /Filters/ }))
  const dialog = await screen.findByRole('dialog', { name: /Filters/ })
  expect(dialog.textContent).not.toMatch(/^Kind$/m)
})

test('summary reports the total instead of a heading', async () => {
  renderNewChrome({ total: 1284 })
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  expect(screen.getByText(/1,284/)).toBeInTheDocument()
})

test('sort defaults do not inflate the filter badge', async () => {
  // Start clean: LibraryApp restores filters from a cookie, and earlier tests
  // in this file apply real filters, so without this the badge legitimately
  // counts a leftover from a previous test rather than a sort default.
  for (const c of document.cookie.split(';')) {
    document.cookie = `${c.split('=')[0].trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  }

  // Caught by looking at the capture: an untouched library showed "Filters 2"
  // because sort_by and sort_order always carry a value from preferences.
  // A badge that counts things nobody set sends people hunting for a filter
  // they never applied.
  renderNewChrome()
  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  const trigger = screen.getByRole('button', { name: /Filters/ })
  expect(trigger).not.toHaveClass('is-on')
  expect(trigger.textContent).not.toMatch(/\d/)
})

test('failed first browse uses PageStatus with Retry', async () => {
  const user = userEvent.setup()
  let failBrowse = true
  const fetchMock = vi.fn((url) => {
    if (typeof url === 'string' && url.startsWith('/browse_games?')) {
      if (failBrowse) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Unable to load games.' }),
        })
      }
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
        ],
        pages: 1,
        current_page: 1,
        total: 1,
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
        gamesCount: 1,
      }}
    />,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load games.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

  failBrowse = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Game A')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  vi.unstubAllGlobals()
})
