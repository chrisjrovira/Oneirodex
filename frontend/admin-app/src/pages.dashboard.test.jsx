import { render, screen } from '@testing-library/react'
import { DashboardPage } from './pages'

test('DashboardPage Refresh sits in footer and disk values use health tones', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          as_of: new Date().toISOString(),
          issues: { overall: 'warn', items: [] },
          host: {
            load_avg: { 1: 0.2, 5: 0.3, 15: 0.4 },
            process: { rss_bytes: 1024, pid: 9 },
            db_ping_ms: 12,
            cpu: { percent: 5 },
            memory: { percent: 20, used: 1, total: 4 },
            disk_games: { percent: 96 },
          },
          library: {
            libraries: 2,
            games: 10,
            unmatched_folders: 1,
            health: { score: 81, grade: 'good', factors: [] },
          },
          scans: { active_count: 1, jobs: [{ library: 'Main', progress: 40 }] },
          services: {
            readyz: { status: 'ok', check_ms: 3 },
            companions: {
              online: 1,
              registered: 2,
              by_kind: { desktop: { online: 1, registered: 2 } },
              last_seen: { within_1h: 1, stale: 0 },
            },
          },
          recent_errors: [],
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  const { container } = render(<DashboardPage />)
  const refresh = await screen.findByRole('button', { name: 'Refresh' })
  const footer = refresh.closest('.gt-admin-dashboard-footer')
  expect(footer).toBeTruthy()
  expect(footer.querySelector('.gt-ops-refresh--footer')).toBeTruthy()
  const strip = screen.getByLabelText('Key metrics')
  expect(strip.querySelector('.gt-ops-metric--action')).toBeTruthy()
  expect(strip.querySelector('.gt-ops-metric--good')).toBeTruthy()
  expect(strip.querySelector('.gt-ops-metric--info')).toBeTruthy()
  expect(container.querySelector('.gt-ops-refresh--footer')).toContainElement(refresh)
})

test('DashboardPage shows library health tile when library.health present', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          as_of: new Date().toISOString(),
          issues: { overall: 'good', items: [] },
          host: {
            load_avg: null,
            process: null,
            db_ping_ms: null,
            cpu: { percent: 5 },
            memory: { percent: 20, used: 1, total: 4 },
            disk_games: { percent: 40 },
          },
          library: {
            libraries: 2,
            games: 10,
            unmatched_folders: 1,
            health: {
              score: 81,
              grade: 'good',
              factors: [{ id: 'missing_cover', label: 'Missing cover', count: 2 }],
            },
          },
          scans: { active_count: 0, jobs: [] },
          services: {
            readyz: null,
            companions: {
              online: 0,
              registered: 0,
              by_kind: {},
              last_seen: { within_1h: 0, stale: 0 },
            },
          },
          recent_errors: [],
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<DashboardPage />)

  const strip = await screen.findByLabelText('Key metrics')
  expect(strip).toHaveTextContent(/Library health/)
  expect(strip).toHaveTextContent(/81 · good/)
  expect(strip).toHaveTextContent(/Missing cover/)
  expect(strip.querySelector('.gt-ops-metric--good')).toBeTruthy()
})

test('DashboardPage renders Action required and Warning / Info folds', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          as_of: new Date().toISOString(),
          issues: {
            overall: 'bad',
            items: [
              {
                id: 'readyz_fail',
                severity: 'bad',
                category: 'action',
                message: 'Readyz probe failing',
                href: '/admin/system_logs',
              },
              {
                id: 'disk_games_critical',
                severity: 'warn',
                category: 'warning',
                message: 'Games disk 96% used',
              },
              {
                id: 'recent_errors',
                severity: 'warn',
                category: 'warning',
                message: '3 error event(s) in the last 24h',
                href: '/admin/system_logs',
              },
            ],
          },
          host: {
            load_avg: null,
            process: null,
            db_ping_ms: null,
            cpu: { percent: 5 },
            memory: { percent: 20, used: 1, total: 4 },
            disk_games: { percent: 96 },
          },
          library: { libraries: 2, games: 10, unmatched_folders: 1 },
          scans: { active_count: 0, jobs: [] },
          services: {
            readyz: null,
            companions: {
              online: 0,
              registered: 0,
              by_kind: {},
              last_seen: { within_1h: 0, stale: 0 },
            },
          },
          recent_errors: [],
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<DashboardPage />)

  expect(await screen.findByRole('heading', { name: 'Action required' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Warning / Info' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Readyz probe failing/i })).toHaveAttribute(
    'href',
    '/admin/system_logs',
  )
  expect(screen.getByText('Games disk 96% used')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /3 error event\(s\) in the last 24h/i })).toHaveAttribute(
    'href',
    '/admin/system_logs',
  )
  const health = screen.getByLabelText('Health')
  expect(health).toHaveClass('gt-ops-status--bad')
  // GT-C1 (UID-013): headline is a verdict; the fold titles are the buckets.
  // Each label must appear exactly once on the Dashboard.
  expect(health.querySelector('.gt-ops-status__head strong')).toHaveTextContent('Needs attention')
  expect(screen.getAllByText('Action required')).toHaveLength(1)
  expect(screen.getAllByText('Warning / Info')).toHaveLength(1)
  expect(screen.getAllByText('n/a').length).toBeGreaterThan(0)
})

test('DashboardPage disk-only issues stay Warning / Info', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          as_of: new Date().toISOString(),
          issues: {
            overall: 'warn',
            items: [
              {
                id: 'disk_games_critical',
                severity: 'warn',
                category: 'warning',
                message: 'Games disk 96% used',
              },
            ],
          },
          host: {
            load_avg: null,
            process: null,
            db_ping_ms: null,
            cpu: { percent: 5 },
            memory: { percent: 20, used: 1, total: 4 },
            disk_games: { percent: 96 },
          },
          library: { libraries: 2, games: 10, unmatched_folders: 1 },
          scans: { active_count: 0, jobs: [] },
          services: {
            readyz: null,
            companions: {
              online: 0,
              registered: 0,
              by_kind: {},
              last_seen: { within_1h: 0, stale: 0 },
            },
          },
          recent_errors: [],
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<DashboardPage />)

  expect(await screen.findByRole('heading', { name: 'Warning / Info' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Action required' })).not.toBeInTheDocument()
  expect(screen.getByText('Games disk 96% used')).toBeInTheDocument()
  const health = screen.getByLabelText('Health')
  expect(health).toHaveClass('gt-ops-status--warn')
  expect(health.querySelector('.gt-ops-status__head strong')).toHaveTextContent('Degraded')
  expect(screen.getAllByText('Warning / Info')).toHaveLength(1)
})
