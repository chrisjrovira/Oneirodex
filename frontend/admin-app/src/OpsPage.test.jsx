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

function mockOpsSummary(overrides = {}) {
  return {
    as_of: new Date().toISOString(),
    issues: {
      overall: 'warn',
      items: [
        {
          id: 'scan_failures',
          severity: 'warn',
          message: '1 scan job(s) failed or errored',
          href: '/scan_management',
        },
      ],
    },
    host: {
      hostname: 'unraid',
      os: 'Linux',
      ip: '10.0.0.2',
      cpu: { percent: 12, cores_logical: 8 },
      memory: { percent: 40, used: 8e9, total: 16e9 },
      load_avg: { 1: 0.4, 5: 0.5, 15: 0.6 },
      process: { pid: 42, rss_bytes: 256 * 1024 * 1024 },
      db_ping_ms: 1.2,
      disk_games: { percent: 55, used: 1e12, total: 2e12 },
      uptime_system: '1d',
      uptime_app: '2h',
    },
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
    library: { libraries: 1, games: 2, unmatched_folders: 0, download_requests_open: 0 },
    services: {
      livekit: { configured: false, enabled: false },
      malware: { enabled: false },
      companions: {
        online: 1,
        registered: 2,
        window_minutes: 3,
        by_kind: { windows: { online: 1, registered: 2 } },
        last_seen: { newest: new Date().toISOString(), within_1h: 1, within_24h: 2, stale: 1 },
      },
      queues: { scans_active: 1, scans_pending: 0, downloads_open: 0 },
      readyz: { status: 'ok', http_status: 200, check_ms: 3.1, checks: { db: 'ok' } },
    },
    ...overrides,
  }
}

test('OpsPage Scans tile renders honest counters', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
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

test('OpsPage status banner lists issues with href', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByText('Attention needed')).toBeInTheDocument()
  const issueLink = await screen.findByRole('link', {
    name: /1 scan job\(s\) failed or errored/i,
  })
  expect(issueLink).toHaveAttribute('href', '/scan_management')
  expect(screen.getByText(/0\.4 \/ 0\.5 \/ 0\.6/)).toBeInTheDocument()
  expect(screen.getByText(/1\.2 ms/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Companions' })).toBeInTheDocument()
  expect(screen.getByText('windows')).toBeInTheDocument()
})
