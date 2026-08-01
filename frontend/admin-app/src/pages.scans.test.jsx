import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LibrariesPage, ScansPage } from './pages'
import { SCAN_QUEUE_POLICY } from './scanQueuePolicy'

describe('ScansPage queued jobs', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('/api/scan_jobs_status')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb',
                library_name: 'PCWIN',
                status: 'Running',
                scan_folder: '/storage/pc',
                folders_success: 1,
                folders_failed: 0,
                total_folders: 10,
              },
              {
                id: 'cccccccc-4444-5555-6666-dddddddddddd',
                library_name: 'PS2',
                status: 'Queued',
                queue_position: 1,
                scan_folder: '/storage/ps2',
              },
            ],
          }
        }
        return { ok: false, status: 404, json: async () => ({}) }
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('lists Running and Queued jobs from scan_jobs_status array', async () => {
    render(
      <MemoryRouter>
        <ScansPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Running: yes/i)).toBeInTheDocument()
    expect(screen.getByText(/queued 1/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Queued/)).toBeInTheDocument()
    })
    expect(screen.getByText(/\(#1\)/)).toBeInTheDocument()
    expect(screen.getByText('PCWIN')).toBeInTheDocument()
    expect(screen.getByText('PS2')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Scanning/i)
  })

  test('Refresh all while busy opens conflict modal and posts queue_policy', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const fetchMock = vi.fn(async (url, opts) => {
      if (String(url).includes('/api/scan_jobs_status')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: '1', status: 'Running', library_name: 'PCWIN' }],
        }
      }
      if (String(url).includes('/api/admin/libraries/refresh_all')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'queued', position: 2, count: 1 }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <ScansPage />
      </MemoryRouter>,
    )

    await screen.findByText(/Running: yes/i)
    await user.click(screen.getByRole('button', { name: /refresh all libraries/i }))
    expect(await screen.findByRole('heading', { name: /scan in progress/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /queue this scan/i }))
    await waitFor(() => {
      const refreshCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/api/admin/libraries/refresh_all'),
      )
      expect(refreshCall).toBeTruthy()
      const body = JSON.parse(refreshCall[1].body)
      expect(body.queue_policy).toBe(SCAN_QUEUE_POLICY.QUEUE)
      expect(body.force_parallel).toBe(false)
    })
  })
})

describe('LibrariesPage refresh all', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('idle Refresh all posts default queue_policy fields', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const fetchMock = vi.fn(async (url, opts) => {
      if (String(url).includes('/api/get_libraries')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ uuid: 'lib-1', name: 'PCWIN' }],
        }
      }
      if (String(url).includes('/api/scan_jobs_status')) {
        return { ok: true, status: 200, json: async () => [] }
      }
      if (String(url).includes('/api/admin/libraries/refresh_all')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'started', count: 1, message: 'started' }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <LibrariesPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('PCWIN')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /refresh all libraries/i }))
    await waitFor(() => {
      const refreshCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/api/admin/libraries/refresh_all'),
      )
      expect(refreshCall).toBeTruthy()
      const body = JSON.parse(refreshCall[1].body)
      expect(body).toEqual({ queue_policy: 'queue', force_parallel: false })
    })
  })
})
