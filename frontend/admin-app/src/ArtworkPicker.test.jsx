import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ArtworkPicker } from './ArtworkPicker'

test('ArtworkPicker searches covers and surfaces apply failure reason', async () => {
  global.fetch = vi.fn(async (url, opts) => {
    const u = String(url)
    if (u.includes('/api/providers') && !u.includes('/search')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          providers: [{ id: 'steamgriddb', enabled: true }, { id: 'igdb', enabled: true }],
        }),
      }
    }
    if (u.includes('/api/search_metadata/sources')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sources: [
            { id: 'meta_quest', name: 'Meta Quest Store', ownership_only: true },
            { id: 'epic', name: 'Epic Games Store', ownership_only: true },
            { id: 'itch', name: 'itch.io' },
            { id: 'giantbomb', name: 'GiantBomb', needs_key: true },
            {
              id: 'mobygames',
              name: 'MobyGames',
              needs_key: true,
              key_configured: false,
              note: 'Optional Class D catalog search (MOBYGAMES_API_KEY).',
            },
            {
              id: 'thegamesdb',
              name: 'TheGamesDB',
              needs_key: true,
              key_configured: false,
              note: 'Optional Class D catalog search (THEGAMESDB_API_KEY).',
            },
          ],
        }),
      }
    }
    if (u.includes('/admin/api/covers/search') && opts?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              id: '1',
              url: 'https://example.com/cover.jpg',
              thumb_url: 'https://example.com/thumb.jpg',
              game_name: 'Celeste',
              provider: 'steamgriddb',
            },
          ],
        }),
      }
    }
    if (u.includes('/admin/api/covers/apply') && opts?.method === 'POST') {
      return {
        ok: false,
        status: 502,
        json: async () => ({ error: 'Download blocked: permission denied on IMAGE_SAVE_PATH' }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  render(
    <MemoryRouter>
      <ArtworkPicker gameUuid="abc-123" gameName="Celeste" />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('button', { name: /Meta Quest Store/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Epic Games Store/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /MobyGames/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /MobyGames/i })).toHaveTextContent(/· key/)
  expect(screen.getByRole('button', { name: /TheGamesDB/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /TheGamesDB/i })).toHaveTextContent(/· key/)

  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByRole('button', { name: /Celeste/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Celeste/i }))
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/permission denied/i)
  })
})

test('ArtworkPicker identify chip searches metadata source', async () => {
  const calls = []
  global.fetch = vi.fn(async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method || 'GET' })
    const u = String(url)
    if (u.includes('/api/providers') && !u.includes('/search')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) }
    }
    if (u.includes('/api/search_metadata/sources')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sources: [{ id: 'meta_quest', name: 'Meta Quest Store', ownership_only: true }],
        }),
      }
    }
    if (u.includes('/api/search_metadata?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'mq-1',
              name: 'Beat Saber',
              cover_url: 'https://example.com/quest.jpg',
            },
          ],
          ownership_only: true,
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  render(
    <MemoryRouter>
      <ArtworkPicker gameUuid="abc-123" gameName="Beat Saber" />
    </MemoryRouter>,
  )

  fireEvent.click(await screen.findByRole('button', { name: /Meta Quest Store/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByRole('button', { name: /Beat Saber/i })).toBeInTheDocument()
  expect(calls.some((c) => c.url.includes('/api/search_metadata?') && c.url.includes('source=meta_quest'))).toBe(
    true,
  )
})

test('ArtworkPicker MobyGames chip soft-honesty when key unset', async () => {
  const calls = []
  global.fetch = vi.fn(async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method || 'GET' })
    const u = String(url)
    if (u.includes('/api/providers') && !u.includes('/search')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) }
    }
    if (u.includes('/api/search_metadata/sources')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sources: [
            {
              id: 'mobygames',
              name: 'MobyGames',
              needs_key: true,
              key_configured: false,
              note: 'Optional Class D catalog search (MOBYGAMES_API_KEY).',
            },
          ],
        }),
      }
    }
    if (u.includes('/api/search_metadata?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          source: 'mobygames',
          results: [],
          needs_key: true,
          key_configured: false,
          note: 'MOBYGAMES_API_KEY not configured — empty results. Metadata only — never downloads games.',
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  render(
    <MemoryRouter>
      <ArtworkPicker gameUuid="abc-123" gameName="Celeste" />
    </MemoryRouter>,
  )

  fireEvent.click(await screen.findByRole('button', { name: /MobyGames/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(
    await screen.findByText(/MOBYGAMES_API_KEY not configured — empty results/i),
  ).toBeInTheDocument()
  expect(calls.some((c) => c.url.includes('/api/search_metadata?') && c.url.includes('source=mobygames'))).toBe(
    true,
  )
})

test('ArtworkPicker TheGamesDB chip soft-honesty when key unset', async () => {
  const calls = []
  global.fetch = vi.fn(async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method || 'GET' })
    const u = String(url)
    if (u.includes('/api/providers') && !u.includes('/search')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) }
    }
    if (u.includes('/api/search_metadata/sources')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sources: [
            {
              id: 'thegamesdb',
              name: 'TheGamesDB',
              needs_key: true,
              key_configured: false,
              note: 'Optional Class D catalog search (THEGAMESDB_API_KEY).',
            },
          ],
        }),
      }
    }
    if (u.includes('/api/search_metadata?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          source: 'thegamesdb',
          results: [],
          needs_key: true,
          key_configured: false,
          note: 'THEGAMESDB_API_KEY not configured — empty results. Metadata only — never downloads games.',
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  render(
    <MemoryRouter>
      <ArtworkPicker gameUuid="abc-123" gameName="Sonic" />
    </MemoryRouter>,
  )

  fireEvent.click(await screen.findByRole('button', { name: /TheGamesDB/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(
    await screen.findByText(/THEGAMESDB_API_KEY not configured — empty results/i),
  ).toBeInTheDocument()
  expect(
    calls.some((c) => c.url.includes('/api/search_metadata?') && c.url.includes('source=thegamesdb')),
  ).toBe(true)
})
