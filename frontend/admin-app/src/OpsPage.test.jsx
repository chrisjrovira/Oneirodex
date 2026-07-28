import { render, screen, waitFor } from '@testing-library/react'
import { formatScanJobCounters, OpsPage } from './OpsPage'

describe('formatScanJobCounters', () => {
  test('uses processed (success+failed) over success-only', () => {
    expect(
      formatScanJobCounters({
        folders_success: 1,
        folders_failed: 2,
        total_folders: 10,
        status: 'Running',
      }),
    ).toBe('3/10 · 2 failed')
  })

  test('shows Starting when total is still zero', () => {
    expect(
      formatScanJobCounters({
        folders_success: 0,
        folders_failed: 0,
        total_folders: 0,
        status: 'Running',
      }),
    ).toBe('Starting…')
  })

  test('omits failed suffix when zero failures', () => {
    expect(
      formatScanJobCounters({
        folders_success: 4,
        folders_failed: 0,
        total_folders: 10,
        status: 'Running',
      }),
    ).toBe('4/10')
  })
})

test('OpsPage Scans tile renders honest counters', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          as_of: new Date().toISOString(),
          issues: { overall: 'good' },
          scans: {
            active_count: 1,
            jobs: [
              {
                id: 'abcdef12-3456-7890-abcd-ef1234567890',
                id_short: 'abcdef12',
                library: 'PC',
                status: 'Running',
                folders_success: 1,
                folders_failed: 2,
                total_folders: 10,
                current_processing: 'Some Game',
              },
            ],
          },
          library: { libraries: 1, games: 2 },
          services: {
            livekit: { configured: false, enabled: false },
            malware: { enabled: false },
            companions: { online: 0, registered: 0 },
            queues: { scans_active: 1, scans_pending: 0, downloads_open: 0 },
          },
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Scans' })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByText(/3\/10 · 2 failed/)).toBeInTheDocument()
  })
  expect(screen.getByText(/Some Game/)).toBeInTheDocument()
})
