import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ArtStudioPage } from './ArtStudioPage'

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/art_studio#studio')
})

function mockFetch(handlers) {
  return vi.fn(async (url, init) => {
    const key = `${(init?.method || 'GET').toUpperCase()} ${String(url).split('?')[0]}`
    for (const [match, body] of Object.entries(handlers)) {
      if (key.includes(match) || String(url).includes(match)) {
        const payload = typeof body === 'function' ? body(url, init) : body
        return {
          ok: true,
          status: 200,
          json: async () => payload,
        }
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: `unexpected ${key}` }),
    }
  })
}

test('Art studio tabs switch Placeholders and Pick & queue', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  global.fetch = mockFetch({
    '/admin/api/image_queue_list': { images: [], pagination: {} },
    '/api/get_libraries': [],
    '/api/library_platforms': [],
    '/api/health/library': { worst: [] },
    '/api/providers': { providers: [] },
    '/api/search_metadata/sources': { sources: [] },
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/art_studio']}>
        <ArtStudioPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Art studio' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Placeholders' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByLabelText(/System \/ platform|System for art template/i)).toBeInTheDocument()
    expect(screen.getAllByText(/200×300/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/400×600/).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('tab', { name: /Pick & queue/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mass image queue' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Auto-pick best available/i })).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})

test('system selector drives preview requests at tile sizes', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  const calls = []
  global.fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body })
    if (String(url).includes('/admin/api/art-studio/preview')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ preview: 'data:image/webp;base64,AAA' }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/art_studio']}>
        <ArtStudioPage />
      </MemoryRouter>,
    )
    const titleInput = screen.getAllByPlaceholderText(/Chrono Trigger/i)[0]
    await user.clear(titleInput)
    await user.type(titleInput, 'Chrono Trigger')
    await user.click(screen.getAllByRole('button', { name: /Preview tiles/i })[0])
    await waitFor(() => {
      const previews = calls.filter((c) => c.url.includes('/admin/api/art-studio/preview'))
      expect(previews.length).toBeGreaterThanOrEqual(2)
      const bodies = previews.map((c) => JSON.parse(c.body))
      expect(bodies.some((b) => b.width === 200 && b.height === 300)).toBe(true)
      expect(bodies.some((b) => b.width === 400 && b.height === 600)).toBe(true)
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('batch placeholders prefer art-studio/batch-generate', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  const posts = []
  global.fetch = vi.fn(async (url, init) => {
    const method = (init?.method || 'GET').toUpperCase()
    if (method === 'POST') {
      posts.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    }
    if (String(url).includes('/api/health/library')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          worst: [{ uuid: 'g1', name: 'No Cover Game', score: 1, issues: [{ code: 'missing_cover' }] }],
        }),
      }
    }
    if (String(url).includes('/admin/api/art-studio/batch-generate')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          applied: 1,
          failed: 0,
          results: [{ game_uuid: 'g1', name: 'No Cover Game' }],
          errors: [],
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/art_studio']}>
        <ArtStudioPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /Load no-cover list/i }))
    expect(await screen.findByText(/No Cover Game/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Apply placeholders \(1\)/i }))
    await waitFor(() => {
      expect(posts.some((p) => p.url.includes('/admin/api/art-studio/batch-generate'))).toBe(true)
    })
    expect(posts.some((p) => p.url.includes('/admin/api/covers/batch/apply'))).toBe(false)
    expect(await screen.findByText(/Batch generate finished/i)).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
