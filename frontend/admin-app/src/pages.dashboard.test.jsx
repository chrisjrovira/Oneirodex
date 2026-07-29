import { render, screen } from '@testing-library/react'
import { DashboardPage } from './pages'

test('DashboardPage renders Action required issues with links', async () => {
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
                id: 'disk_games_critical',
                severity: 'bad',
                message: 'Games disk 96% used',
              },
              {
                id: 'recent_errors',
                severity: 'warn',
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

  expect(await screen.findByText('Action required')).toBeInTheDocument()
  expect(screen.getByText('Games disk 96% used')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /3 error event\(s\) in the last 24h/i })).toHaveAttribute(
    'href',
    '/admin/system_logs',
  )
  expect(screen.getAllByText('n/a').length).toBeGreaterThan(0)
})
