import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { OpsApp } from './OpsApp'
import { fetchOpsSummary } from './api/summary'

vi.mock('./api/summary', () => ({
  fetchOpsSummary: vi.fn(),
}))

const snapshot = {
  as_of: '2026-07-22T23:00:00+00:00',
  host: {
    hostname: 'ops-host',
    os: 'Linux',
    ip: '127.0.0.1',
    python: '3.12',
    cpu: { percent: 10, cores_physical: 4, cores_logical: 8 },
    memory: { total: 1000, used: 500, available: 500, percent: 50 },
    disk_base: { total: 1000, used: 500, free: 500, percent: 50 },
    disk_games: { total: 1000, used: 500, free: 500, percent: 50 },
    uptime_system: '1 day',
    uptime_app: '1 hour',
  },
  issues: { overall: 'good', items: [] },
}

describe('OpsApp', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the hostname from the first successful summary', async () => {
    fetchOpsSummary.mockResolvedValueOnce(snapshot)

    render(<OpsApp pollMs={15000} />)

    expect(await screen.findByText('ops-host')).toBeInTheDocument()
  })

  test('aborts an in-flight request on unmount without applying its result', async () => {
    let resolveSummary
    fetchOpsSummary.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSummary = resolve
        }),
    )

    const { unmount } = render(<OpsApp pollMs={15000} />)
    const signal = fetchOpsSummary.mock.calls[0][0].signal

    unmount()
    resolveSummary(snapshot)

    await waitFor(() => expect(signal.aborted).toBe(true))
    expect(screen.queryByText('ops-host')).not.toBeInTheDocument()
  })

  test('announces the first load as a polite status', () => {
    fetchOpsSummary.mockImplementationOnce(() => new Promise(() => {}))

    render(<OpsApp pollMs={15000} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading operations summary…')
    expect(screen.queryByText('Host data unavailable.')).not.toBeInTheDocument()
  })

  test('first failed load uses the shared error status instead of empty panels', async () => {
    fetchOpsSummary.mockRejectedValueOnce(new Error('offline'))

    render(<OpsApp pollMs={15000} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Host data unavailable.')).not.toBeInTheDocument()
    expect(screen.queryByText('ops-host')).not.toBeInTheDocument()
  })

  test('keeps the previous snapshot and offers Retry after a failed refresh', async () => {
    fetchOpsSummary.mockResolvedValueOnce(snapshot).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()

    render(<OpsApp pollMs={15000} />)
    expect(await screen.findByText('ops-host')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    expect(screen.getByText('ops-host')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
