import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryApp } from './LibraryApp'

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

const initialConfig = {
  perPage: 20,
  defaultSort: 'name',
  defaultSortOrder: 'asc',
  showPlayStatus: false,
  isAdmin: false,
  libraryCount: 1,
  gamesCount: 1,
  currentFilters: {},
}

afterEach(() => {
  document.cookie = 'libraryFilters=; Max-Age=0; path=/'
  vi.unstubAllGlobals()
})

test('applies libraryFilters cookie on boot', async () => {
  document.cookie = `libraryFilters=${encodeURIComponent(JSON.stringify({ genre: 'Action' }))}; path=/`
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

  render(<LibraryApp initialConfig={initialConfig} />)

  await waitFor(() => {
    const browseCall = fetchMock.mock.calls.find(([url]) =>
      url.startsWith('/browse_games?'),
    )
    expect(browseCall?.[0]).toContain('genre=Action')
  })
})

test('apply omits rating when zero', async () => {
  const user = userEvent.setup()
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

  render(<LibraryApp initialConfig={initialConfig} />)
  await user.click(await screen.findByRole('button', { name: 'Apply filters' }))

  await waitFor(() => {
    const browseUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.startsWith('/browse_games?'))
    expect(browseUrls.at(-1)).not.toContain('rating=')
  })
})

test('apply persists selected filters and refreshes browse results', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn((url) => {
    if (url === '/api/genres') {
      return jsonResponse([{ id: 1, name: 'Action' }])
    }
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

  render(<LibraryApp initialConfig={initialConfig} />)

  await user.selectOptions(
    await screen.findByLabelText('Genre'),
    'Action',
  )
  await user.click(screen.getByRole('button', { name: 'Apply filters' }))

  await waitFor(() => {
    expect(decodeURIComponent(document.cookie)).toContain(
      '"genre":"Action"',
    )
    const browseUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.startsWith('/browse_games?'))
    expect(browseUrls.at(-1)).toContain('genre=Action')
  })
})
