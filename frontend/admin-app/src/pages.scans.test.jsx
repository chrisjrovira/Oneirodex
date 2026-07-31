import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ScansPage } from './pages'

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
  })
})
