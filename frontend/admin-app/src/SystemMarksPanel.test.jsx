import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SystemMarksPanel, normalizeSystemMarksCatalog } from './SystemMarksPanel'

test('normalizeSystemMarksCatalog maps theme progress rows', () => {
  const rows = normalizeSystemMarksCatalog({
    items: [
      { theme: 'default', generated: 2, total: 72, era: 'wood_den_80s', complete: false },
      { theme: 'aurora', generated: 72, total: 72, complete: true },
    ],
  })
  expect(rows).toHaveLength(2)
  expect(rows[0].theme).toBe('default')
  expect(rows[1].complete).toBe(true)
})

test('SystemMarksPanel lists themes and posts generate for selected theme', async () => {
  const user = userEvent.setup()
  const posts = []
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url, init) => {
    const path = String(url).split('?')[0]
    if (path.endsWith('/admin/api/art-studio/system-marks') && (!init?.method || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          items: [
            { theme: 'default', generated: 1, total: 72, era: 'wood_den_80s', complete: false },
            { theme: 'aurora', generated: 0, total: 72, complete: false },
          ],
          count: 2,
          all_platforms: [{ id: 'nes', label: 'NES' }, { id: 'snes', label: 'SNES' }],
        }),
      }
    }
    if (String(url).includes('/admin/api/art-studio/system-marks/lab')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          theme: 'default',
          platform: 'nes',
          prompt: 'product icon of grey Nintendo NES front-loading console',
          url: '/static/library/system-marks/default/nes.webp',
          exists: false,
          negative: 'text',
        }),
      }
    }
    if (path.endsWith('/admin/api/art-studio/system-marks/generate')) {
      posts.push(JSON.parse(init.body))
      return {
        ok: true,
        status: 201,
        json: async () => ({ ok: true, generated: 1, skipped: 0, errors: [] }),
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: path }) }
  })

  try {
    render(<SystemMarksPanel />)
    expect(await screen.findByTestId('system-marks-panel')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText('aurora')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /aurora 0 of 72/i }))
    await user.click(screen.getByRole('button', { name: /Fill gaps · aurora/i }))

    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]).toMatchObject({ themes: ['aurora'], force: false })
  } finally {
    global.fetch = originalFetch
  }
})

test('lab generates one forced pair and records the attempt', async () => {
  const user = userEvent.setup()
  const posts = []
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url, init) => {
    const path = String(url).split('?')[0]
    if (path.endsWith('/admin/api/art-studio/system-marks') && (!init?.method || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          items: [{ theme: 'aurora', generated: 0, total: 72, complete: false }],
          count: 1,
          all_platforms: [{ id: 'nes', label: 'NES' }],
        }),
      }
    }
    if (path.endsWith('/admin/api/art-studio/system-marks/lab')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          theme: 'aurora',
          platform: 'nes',
          prompt: 'product icon of grey Nintendo NES',
          url: '/static/library/system-marks/aurora/nes.webp',
          exists: false,
        }),
      }
    }
    if (path.endsWith('/admin/api/art-studio/system-marks/generate')) {
      posts.push(JSON.parse(init.body))
      return {
        ok: true,
        status: 201,
        json: async () => ({ ok: true, generated: 1, skipped: 0, errors: [] }),
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: path }) }
  })

  try {
    render(<SystemMarksPanel />)
    expect(await screen.findByTestId('system-marks-lab')).toBeInTheDocument()
    const prompt = await screen.findByLabelText('Lab prompt')
    expect(prompt).toHaveValue('product icon of grey Nintendo NES')
    await user.click(screen.getByRole('button', { name: /Generate aurora\/nes/i }))
    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]).toMatchObject({
      themes: ['aurora'],
      platforms: ['nes'],
      force: true,
    })
    expect(screen.getByTestId('system-marks-lab-log')).toHaveTextContent('aurora/nes')
  } finally {
    global.fetch = originalFetch
  }
})
