import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockPicker, normalizeStockCatalog } from './StockPicker'

const MOCK_CATALOG = {
  items: [
    {
      id: 'platform-snes',
      label: 'SNES aurora',
      kind: 'platform',
      platform: 'SNES',
      pack_id: 'platform-snes',
      generated: true,
      urls: {
        tile: '/static/library/stock/platform-snes/tile_400x600.webp',
        wide: '/static/library/stock/platform-snes/wide_960x540.webp',
      },
    },
    {
      id: 'stock-crt-grid',
      label: 'CRT grid',
      kind: 'stock',
      pack_id: 'stock-crt-grid',
      generated: true,
      urls: { tile: '/static/library/stock/stock-crt-grid/tile_400x600.webp' },
    },
  ],
  count: 2,
}

test('normalizeStockCatalog accepts Backend items wrapper', () => {
  const rows = normalizeStockCatalog(MOCK_CATALOG)
  expect(rows).toHaveLength(2)
  expect(rows[0].kind).toBe('platform')
  expect(rows[0].thumb).toContain('tile_400x600')
  expect(rows[0].generated).toBe(true)
  expect(rows[1].label).toBe('CRT grid')
})

test('normalizeStockCatalog keeps decade-room packs as era kind', () => {
  const rows = normalizeStockCatalog({
    items: [
      {
        id: 'era-80s-den',
        label: '1980s wood den',
        kind: 'era',
        pack_id: 'era-80s-den',
        generated: true,
        urls: { tile: '/static/library/stock/era-80s-den/tile_400x600.webp' },
      },
    ],
  })
  expect(rows[0].kind).toBe('era')
  expect(rows[0].label).toBe('1980s wood den')
})

test('normalizeStockCatalog hides thumbs until generated', () => {
  const rows = normalizeStockCatalog({
    items: [
      {
        id: 'stock-disc-ring',
        label: 'Disc ring',
        kind: 'stock',
        pack_id: 'stock-disc-ring',
        generated: false,
        urls: { tile: '/static/library/stock/stock-disc-ring/tile_400x600.webp' },
      },
    ],
  })
  expect(rows[0].thumb).toBe('')
  expect(rows[0].generated).toBe(false)
})

test('StockPicker renders stock grid from mock catalog and apply posts pack_id', async () => {
  const user = userEvent.setup()
  const posts = []
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url, init) => {
    const method = (init?.method || 'GET').toUpperCase()
    const u = String(url)
    if (u.includes('/admin/api/art-studio/apply') && method === 'POST') {
      posts.push(JSON.parse(init.body))
      return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'fallback' }) }
    }
    if (u.includes('/admin/api/art-studio/stock') && method === 'GET') {
      return { ok: true, status: 200, json: async () => MOCK_CATALOG }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  try {
    render(<StockPicker />)
    expect(await screen.findByTestId('stock-picker-grid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /SNES aurora/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CRT grid/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /CRT grid/i }))
    expect(await screen.findByTestId('stock-picker-preview')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Use as library default/i }))

    await waitFor(() => {
      expect(posts.length).toBe(1)
    })
    expect(posts[0].pack_id).toBe('stock-crt-grid')
    expect(posts[0].mode).toBe('fallback')
    expect(await screen.findByText(/Set “CRT grid” as library default/i)).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})

test('StockPicker generates then applies when pack not on disk', async () => {
  const user = userEvent.setup()
  const posts = []
  let generated = false
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url, init) => {
    const method = (init?.method || 'GET').toUpperCase()
    const u = String(url)
    if (u.includes('/admin/api/art-studio/stock/generate') && method === 'POST') {
      posts.push({ url: u, body: JSON.parse(init.body) })
      generated = true
      return {
        ok: true,
        status: 201,
        json: async () => ({ count: 1, generated: [{ pack_id: 'stock-neon-court' }] }),
      }
    }
    if (u.includes('/admin/api/art-studio/apply') && method === 'POST') {
      posts.push({ url: u, body: JSON.parse(init.body) })
      return { ok: true, status: 200, json: async () => ({ mode: 'fallback' }) }
    }
    if (u.includes('/admin/api/art-studio/stock') && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'stock-neon-court',
              label: 'Neon court',
              kind: 'stock',
              pack_id: 'stock-neon-court',
              generated,
              urls: {
                tile: '/static/library/stock/stock-neon-court/tile_400x600.webp',
                wide: '/static/library/stock/stock-neon-court/wide_960x540.webp',
              },
            },
          ],
          count: 1,
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })

  try {
    render(<StockPicker />)
    await user.click(await screen.findByRole('button', { name: /Neon court/i }))
    await user.click(screen.getByRole('button', { name: /Use as library default/i }))
    await waitFor(() => {
      expect(posts.some((p) => String(p.url).includes('/stock/generate'))).toBe(true)
      expect(posts.some((p) => String(p.url).includes('/art-studio/apply'))).toBe(true)
    })
    const apply = posts.find((p) => String(p.url).includes('/art-studio/apply'))
    expect(apply.body.pack_id).toBe('stock-neon-court')
  } finally {
    global.fetch = originalFetch
  }
})

test('StockPicker soft-empty when catalog API returns 404', async () => {
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/art-studio/stock')) {
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  try {
    render(<StockPicker />)
    expect(await screen.findByTestId('stock-picker-unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Stock catalog coming online/i)).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
