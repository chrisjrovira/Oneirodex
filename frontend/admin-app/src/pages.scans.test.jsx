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

    // Was `/Running: yes/` + `/queued 1/` — the developer readout GT-B34
    // replaced. The summary now names the library and its progress.
    expect(await screen.findByText(/Scanning PCWIN/i)).toBeInTheDocument()
    expect(screen.getByText(/Scanning PCWIN — 1\/10/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Queued/)).toBeInTheDocument()
    })
    expect(screen.getByText(/\(#1\)/)).toBeInTheDocument()
    expect(screen.getByText('PCWIN')).toBeInTheDocument()
    expect(screen.getByText('PS2')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Scanning/i)
  })


  test('a queue with nothing running does not read as idle', async () => {
    // The bug this wording exists for: an orphaned Running job held the queue,
    // and the old readout rendered it as "Running: no · queued 1" — which reads
    // as "nothing to do" rather than "stuck". See the scan-ownership fix.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('/api/scan_jobs_status')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: 'q1', library_name: 'PS2', status: 'Queued', queue_position: 1 },
            ],
          }
        }
        return { ok: false, status: 404, json: async () => ({}) }
      }),
    )

    render(
      <MemoryRouter>
        <ScansPage />
      </MemoryRouter>,
    )

    const summary = await screen.findByText(/1 scan queued, none running/i)
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveTextContent(/waiting on a job that has not reported a result/i)
  })

  test('a failed job shows why, not just that it failed', async () => {
    // The reason is the only thing that explains a queue that stopped moving,
    // and the table used to drop it entirely even though the API returns it.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('/api/scan_jobs_status')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'f1',
                library_name: 'PCWIN',
                status: 'Failed',
                error_message:
                  'Scan owner process is no longer running; reclaimed so queued scans can start.',
                folders_success: 2,
                folders_failed: 1,
                total_folders: 9,
              },
            ],
          }
        }
        return { ok: false, status: 404, json: async () => ({}) }
      }),
    )

    render(
      <MemoryRouter>
        <ScansPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/owner process is no longer running/i)).toBeInTheDocument()
    // …and the progress it got to before dying, which was also never shown.
    expect(screen.getByText('3/9 · 1 failed')).toBeInTheDocument()
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

    await screen.findByText(/Scanning PCWIN/i)
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
