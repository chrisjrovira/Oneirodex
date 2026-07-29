import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ImagesPage } from './ImagesPage'

test('auto-pick posts covers/batch/apply with best-available policy', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  const posts = []
  global.fetch = vi.fn(async (url, init) => {
    const method = (init?.method || 'GET').toUpperCase()
    if (method === 'POST') {
      posts.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    }
    if (String(url).includes('/admin/api/covers/batch/apply')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ applied: 2, failed: 0, policy: ['steamgriddb', 'igdb', 'generate'] }),
      }
    }
    if (String(url).includes('/admin/api/image_queue_list')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          images: [
            {
              id: 9,
              game_uuid: 'g1',
              game_name: 'Celeste',
              image_type: 'cover',
              status: 'failed',
              is_downloaded: false,
              last_error: 'legacy',
              failure_reason: 'HTTP 403 from provider',
            },
          ],
          image_save_path: { exists: true, writable: false, error: 'Permission denied', path: '/images' },
        }),
      }
    }
    if (String(url).includes('/api/get_libraries')) {
      return { ok: true, status: 200, json: async () => [{ uuid: 'lib-1', name: 'SNES' }] }
    }
    if (String(url).includes('/api/library_platforms')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 'SNES', name: 'Super Nintendo', value: 'SNES' }],
      }
    }
    if (String(url).includes('/api/search_metadata/sources')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sources: [
            { id: 'steam', name: 'Steam' },
            { id: 'epic', name: 'Epic Games Store', ownership_only: true },
            { id: 'meta_quest', name: 'Meta Quest Store', ownership_only: true },
          ],
        }),
      }
    }
    if (String(url).includes('/api/health/library')) {
      return { ok: true, status: 200, json: async () => ({ worst: [] }) }
    }
    if (String(url).includes('/api/providers')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/art_studio#images']}>
        <ImagesPage />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: /Art & images/i })).toBeInTheDocument()
    expect(await screen.findByText(/IMAGE_SAVE_PATH: Permission denied/i)).toBeInTheDocument()
    expect(await screen.findByText(/HTTP 403 from provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Platform filter for mass auto-pick/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Service filter for mass cover tools/i)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Platform filter for mass auto-pick/i), 'SNES')
    await user.selectOptions(screen.getByLabelText(/Service filter for mass cover tools/i), 'epic')
    await user.click(screen.getByRole('button', { name: /Auto-pick best available/i }))
    await waitFor(() => {
      expect(posts.some((p) => p.url.includes('/admin/api/covers/batch/apply'))).toBe(true)
    })
    const auto = posts.find((p) => p.url.includes('/admin/api/covers/batch/apply'))
    expect(auto.body.policy).toBe('sgdb_then_igdb_then_generate')
    expect(auto.body.missing_cover).toBe(true)
    expect(auto.body.platform).toBe('SNES')
    expect(auto.body.service).toBe('epic')
    expect(await screen.findByText(/applied 2/i)).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
