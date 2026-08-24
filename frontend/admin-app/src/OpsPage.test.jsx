import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  test('shows Queued (with optional position) when waiting', () => {
    expect(
      formatScanJobCounters({
        status: 'Queued',
        total_folders: 0,
        queue_position: 2,
      }),
    ).toBe('Queued #2')
  })
})

/**
 * OpsPage loads three endpoints, not one: `/ops/summary` for the strip and the
 * folds, `/ops/system` for the System / Database / Logs panels (GT-B21) and
 * `/ops/logs` for the recent-events list.
 *
 * A mock that answers only `summary` and throws on the rest rejects inside the
 * component's own load, and where that rejection lands relative to an assertion
 * depends on scheduling — so tests passed locally and failed on CI, on a
 * different Node. Answering the two ancillary calls with empty-but-valid bodies
 * keeps each test about the thing it is actually asserting, while a genuinely
 * unexpected URL still throws.
 */
function ancillaryOpsResponse(url) {
  const href = String(url)
  if (href.includes('/admin/api/ops/system')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ system: {}, database: {}, logs: {}, config: {} }),
    }
  }
  if (href.includes('/admin/api/ops/logs')) {
    return { ok: true, status: 200, json: async () => ({ events: [] }) }
  }
  return null
}

function mockOpsSummary(overrides = {}) {
  return {
    as_of: new Date().toISOString(),
    issues: {
      overall: 'warn',
      items: [
        {
          id: 'scan_failures',
          severity: 'warn',
          category: 'warning',
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
      library_watch: {
        enabled: false,
        running: false,
        roots: 0,
        pending_libraries: 0,
        debounce_seconds: 3,
        note: 'Set GT_LIBRARY_WATCH=1 to enable root-folder incremental watch.',
      },
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

test('OpsPage shows library health score and top factors when present', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockOpsSummary({
            library: {
              libraries: 1,
              games: 2,
              unmatched_folders: 0,
              download_requests_open: 0,
              health: {
                score: 64,
                grade: 'fair',
                factors: [
                  { id: 'missing_cover', label: 'Missing cover', count: 9 },
                  { id: 'broken_path', label: 'Broken path', count: 2 },
                ],
              },
            },
          }),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Library pulse' })).toBeInTheDocument()
  const strip = screen.getByLabelText('Key metrics')
  expect(strip).toHaveTextContent(/Library health/)
  expect(strip).toHaveTextContent(/64 · fair/)
  expect(strip).toHaveTextContent(/Missing cover/)
  expect(strip.querySelector('.gt-ops-metric--fair')).toBeTruthy()
  const factors = screen.getByLabelText('Top health factors')
  expect(factors).toHaveTextContent(/Missing cover/)
  expect(factors).toHaveTextContent('9')
  expect(factors).toHaveTextContent(/Broken path/)
})

test('OpsPage library health is honest n/a when Backend field absent', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Library pulse' })).toBeInTheDocument()
  const strip = screen.getByLabelText('Key metrics')
  expect(strip).toHaveTextContent(/Library health/)
  expect(strip).toHaveTextContent(/n\/a/)
  expect(strip).toHaveTextContent(/not scored yet/)
  expect(strip.querySelector('.gt-ops-metric--na')).toBeTruthy()
  expect(screen.getByText(/Library health not scored yet/i)).toBeInTheDocument()
})

test('OpsPage Scans tile renders honest counters', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Scans' })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByText(/3\/10 · 2 failed/)).toBeInTheDocument()
  })
  expect(screen.getByText(/Some Game/)).toBeInTheDocument()
})

test('OpsPage shows library watch off honestly', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Services' })).toBeInTheDocument()
  // Strip tile + Services row both say "Library watch"
  expect(screen.getAllByText('Library watch').length).toBeGreaterThanOrEqual(2)
  expect(
    screen.getByText(/Set GT_LIBRARY_WATCH=1 to enable root-folder incremental watch/),
  ).toBeInTheDocument()
  const strip = screen.getByLabelText('Key metrics')
  expect(strip).toHaveTextContent(/Library watch/)
  expect(strip).toHaveTextContent(/off/)
  expect(strip).toHaveTextContent(/GT_LIBRARY_WATCH off/)
})

test('OpsPage shows library watch running with roots and pending', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockOpsSummary({
            services: {
              ...mockOpsSummary().services,
              library_watch: {
                enabled: true,
                running: true,
                roots: 3,
                pending_libraries: 2,
                debounce_seconds: 3,
                note: null,
              },
            },
          }),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Services' })).toBeInTheDocument()
  expect(screen.getByText(/3 roots · 2 pending · 3s debounce/)).toBeInTheDocument()
  const strip = screen.getByLabelText('Key metrics')
  expect(strip).toHaveTextContent(/Library watch/)
  expect(strip).toHaveTextContent(/running/)
  expect(strip).toHaveTextContent(/3 roots · 2 pending/)
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
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  // GT-C1: the banner headline is now "Degraded", so the fold title is the only
  // "Warning / Info" on the page — assert that there is exactly one.
  expect(await screen.findByRole('heading', { name: 'Warning / Info' })).toBeInTheDocument()
  expect(screen.getAllByText('Warning / Info')).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: 'Action required' })).not.toBeInTheDocument()
  const issueLink = await screen.findByRole('link', {
    name: /1 scan job\(s\) failed or errored/i,
  })
  expect(issueLink).toHaveAttribute('href', '/scan_management')
  expect(screen.getByText(/0\.4 \/ 0\.5 \/ 0\.6/)).toBeInTheDocument()
  expect(screen.getByText(/1\.2 ms/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Companions' })).toBeInTheDocument()
  expect(screen.getByText('windows')).toBeInTheDocument()
})

test('OpsPage splits action and warning folds; category maps to action', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockOpsSummary({
            issues: {
              overall: 'warn',
              items: [
                {
                  id: 'readyz_down',
                  severity: 'warn',
                  category: 'action',
                  message: 'Readyz probe failing',
                  href: '/admin/system_logs',
                },
                {
                  id: 'disk_games_warn',
                  severity: 'warn',
                  category: 'warning',
                  message: 'Games disk 88% used',
                },
              ],
            },
          }),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  // Banner prefers Action required when any action-fold item exists
  expect(await screen.findByRole('heading', { name: 'Action required' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Warning / Info' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Readyz probe failing/i })).toHaveAttribute(
    'href',
    '/admin/system_logs',
  )
  expect(screen.getByText('Games disk 88% used')).toBeInTheDocument()
  // Status strip strong label (banner head) — action items still win over overall=warn,
  // but the headline is a verdict, not a repeat of the fold title (GT-C1).
  const status = screen.getByLabelText('System status')
  expect(status).toHaveClass('gt-ops-status--bad')
  expect(status.querySelector('.gt-ops-status__head strong')).toHaveTextContent('Needs attention')
  expect(screen.getAllByText('Action required')).toHaveLength(1)
})

test('OpsPage keeps disk_*_critical in Warning / Info fold', async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/ops/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          mockOpsSummary({
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
          }),
      }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Warning / Info' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Action required' })).not.toBeInTheDocument()
  expect(screen.getByText('Games disk 96% used')).toBeInTheDocument()
  const status = screen.getByLabelText('System status')
  expect(status).toHaveClass('gt-ops-status--warn')
  expect(status.querySelector('.gt-ops-status__head strong')).toHaveTextContent('Degraded')
  expect(screen.getAllByText('Warning / Info')).toHaveLength(1)
})

test('OpsPage manual Refresh shows status; poll does not wipe content', async () => {
  const user = userEvent.setup()
  let resolveSecond
  const secondPromise = new Promise((resolve) => {
    resolveSecond = resolve
  })
  let callCount = 0
  global.fetch = vi.fn(async (url) => {
    if (!String(url).includes('/admin/api/ops/summary')) {
      const ancillary = ancillaryOpsResponse(url)
      if (ancillary) return ancillary
      throw new Error(`unexpected fetch ${url}`)
    }
    // Only the summary calls are counted, so the ancillary endpoints above
    // cannot advance the first/second-response sequence this test depends on.
    callCount += 1
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => mockOpsSummary(),
      }
    }
    await secondPromise
    return {
      ok: true,
      status: 200,
      json: async () =>
        mockOpsSummary({
          host: {
            ...mockOpsSummary().host,
            db_ping_ms: 9.9,
          },
        }),
    }
  })

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'Scans' })).toBeInTheDocument()
  expect(screen.getByText(/1\.2 ms/)).toBeInTheDocument()
  expect(screen.queryByText(/Loading ops summary/i)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Refresh$/i }))
  expect(screen.getByRole('status')).toHaveTextContent(/Refreshing/i)
  expect(screen.getByRole('heading', { name: 'Scans' })).toBeInTheDocument()

  resolveSecond()
  await waitFor(() => {
    expect(screen.getByText(/9\.9 ms/)).toBeInTheDocument()
  })
})

/**
 * Reordering the Ops detail panels (task #6).
 *
 * Buttons rather than drag handles, and the DOM is rewritten rather than the
 * panels being given a CSS `order`: visual order that disagrees with tab order
 * is a worse bug than the one being fixed. Asserting on heading *sequence* is
 * what catches that — a CSS-only reorder would leave this test passing while
 * the page lied to anyone tabbing through it.
 */
function mockOpsWithSystemDetail() {
  return vi.fn(async (url) => {
    const href = String(url)
    if (href.includes('/admin/api/ops/summary')) {
      return { ok: true, status: 200, json: async () => mockOpsSummary() }
    }
    if (href.includes('/admin/api/ops/system')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          system: { OS: 'Linux' },
          database: { Engine: 'PostgreSQL' },
          logs: { count: 3 },
          config: { DEBUG: 'false' },
        }),
      }
    }
    if (href.includes('/admin/api/ops/logs')) {
      return { ok: true, status: 200, json: async () => ({ events: [] }) }
    }
    const ancillary = ancillaryOpsResponse(url)
    if (ancillary) return ancillary
    throw new Error(`unexpected fetch ${url}`)
  })
}

function clearStoredOrder() {
  // localStorage is not provided in this vitest environment, which is itself
  // worth knowing: useWidgetOrder has to degrade to the declared order rather
  // than throwing, and these tests exercise exactly that path.
  try {
    window.localStorage?.removeItem('gt-widget-order:ops-detail')
  } catch {
    // nothing stored to clear
  }
}

function detailHeadings() {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent)
    .filter((text) => ['System', 'Database', 'Logs', 'Configuration'].includes(text))
}

test('OpsPage detail panels can be reordered from the keyboard', async () => {
  const user = userEvent.setup()
  clearStoredOrder()
  global.fetch = mockOpsWithSystemDetail()

  render(<OpsPage />)

  expect(await screen.findByRole('heading', { name: 'System', level: 2 })).toBeInTheDocument()
  expect(detailHeadings()).toEqual(['System', 'Database', 'Logs', 'Configuration'])

  await user.click(screen.getByRole('button', { name: 'Move Database earlier' }))

  expect(detailHeadings()).toEqual(['Database', 'System', 'Logs', 'Configuration'])
})

test('OpsPage disables the move that would fall off the end', async () => {
  clearStoredOrder()
  global.fetch = mockOpsWithSystemDetail()

  render(<OpsPage />)

  await screen.findByRole('heading', { name: 'System', level: 2 })

  // Disabled rather than hidden, so the control group keeps its width and the
  // buttons stay where the hand expects them as a panel moves.
  expect(screen.getByRole('button', { name: 'Move System earlier' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move Configuration later' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Move System later' })).toBeEnabled()
})
