import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UpdatesPage } from './UpdatesPage'
import * as updatesApi from '../api/updates'
import * as clientCommands from '../api/clientCommands'
import * as calendarApi from '../api/calendar'

vi.mock('../api/updates', () => ({
  fetchUpdatesInbox: vi.fn(),
  fetchStoreSearch: vi.fn(),
  addWantedUpdate: vi.fn(),
  scanLibraryUpdates: vi.fn(),
}))

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(),
}))

vi.mock('../api/calendar', () => ({
  fetchCalendar: vi.fn(),
}))

beforeEach(() => {
  updatesApi.fetchUpdatesInbox.mockReset()
  updatesApi.fetchStoreSearch.mockReset()
  updatesApi.addWantedUpdate?.mockReset?.()
  updatesApi.scanLibraryUpdates.mockReset()
  updatesApi.scanLibraryUpdates.mockResolvedValue({
    ok: true,
    checked: 0,
    behind_count: 0,
    behind: [],
    errors: [],
    remaining: 0,
  })
  clientCommands.queueClientCommand.mockReset()
  calendarApi.fetchCalendar.mockReset()
  calendarApi.fetchCalendar.mockResolvedValue({
    releases: [
      {
        igdb_id: 9,
        name: 'Soon Game',
        first_release_date: '2026-09-01',
        window: 'upcoming',
      },
    ],
  })
  updatesApi.fetchUpdatesInbox.mockResolvedValue({
    items: [
      {
        uuid: 'game-1',
        name: 'Behind Game',
        freshness_status: 'behind',
        local_version: '1.0',
        remote_version_summary: 'STEAM: 1.1',
        updates_count: 1,
        client_connected: true,
        latest_update: {
          kind: 'update',
          uuid: 'upd-1',
          label: 'Update: patch.zip',
          download_url: '/download_other/update/game-1/upd-1',
        },
      },
    ],
  })
})

test('inbox shows apply action and queues companion update pack', async () => {
  const user = userEvent.setup()
  clientCommands.queueClientCommand.mockResolvedValue({ ok: true })

  render(
    <MemoryRouter>
      <UpdatesPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Behind Game')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Download update/i })).toHaveAttribute(
    'href',
    '/download_other/update/game-1/upd-1',
  )

  await user.click(screen.getByRole('button', { name: /Apply with companion/i }))
  await waitFor(() => {
    expect(clientCommands.queueClientCommand).toHaveBeenCalledWith('game-1', 'update', {
      kind: 'update',
      versionUuid: 'upd-1',
    })
  })
  expect(
    await screen.findByText((_, el) => el?.classList?.contains('gt-updates__status') && /queued for companion/i.test(el.textContent || '')),
  ).toBeInTheDocument()
})

test('manual Refresh shows brief feedback without wiping inbox', async () => {
  const user = userEvent.setup()
  let resolveInbox
  updatesApi.fetchUpdatesInbox
    .mockResolvedValueOnce({
      items: [
        {
          uuid: 'game-1',
          name: 'Behind Game',
          freshness_status: 'behind',
          local_version: '1.0',
          remote_version_summary: 'STEAM: 1.1',
          updates_count: 1,
          client_connected: false,
        },
      ],
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInbox = resolve
        }),
    )

  render(
    <MemoryRouter>
      <UpdatesPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Behind Game')).toBeInTheDocument()
  // Glyph-only control: its accessible name says which list it refreshes,
  // because the row also holds "Check library for updates".
  await user.click(
    screen.getByRole('button', { name: 'Refresh the freshness inbox' }),
  )
  expect(screen.getByRole('status')).toHaveTextContent(/Refreshing/i)
  expect(screen.getByText('Behind Game')).toBeInTheDocument()

  resolveInbox({
    items: [
      {
        uuid: 'game-1',
        name: 'Behind Game',
        freshness_status: 'behind',
        local_version: '1.0',
        remote_version_summary: 'STEAM: 1.2',
        updates_count: 1,
        client_connected: false,
      },
    ],
  })

  await waitFor(() => {
    expect(screen.queryByText(/^Refreshing…$/)).not.toBeInTheDocument()
  })
})

test('shows upcoming releases teaser with calendar link', async () => {
  render(
    <MemoryRouter>
      <UpdatesPage />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: /Upcoming releases/i })).toBeInTheDocument()
  expect(await screen.findByText('Soon Game')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Open calendar/i })).toHaveAttribute('href', '/calendar')
})

test('refresh and its timestamp sit on the inbox heading row', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <UpdatesPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )
  await waitFor(() => expect(updatesApi.fetchUpdatesInbox).toHaveBeenCalled())

  expect(screen.queryByRole('heading', { name: 'Updates' })).toBeNull()

  // The refresh status is the only thing that says whether what you are
  // looking at is current, so it has to survive the move — losing it would
  // make a stale inbox indistinguishable from a fresh one. The control is a
  // symbol on the inbox heading now rather than a word in bar two, and the
  // timestamp reads *before* the glyph. Queried by role+name precisely so the
  // icon cannot ship without an accessible name.
  const refresh = await screen.findByRole('button', {
    name: 'Refresh the freshness inbox',
  })
  expect(refresh.closest('.gt-updates__inbox-tools')).not.toBeNull()
  await user.click(refresh)
  await waitFor(() => expect(screen.getByText(/^Updated /)).toBeInTheDocument())

  const tools = refresh.closest('.gt-updates__inbox-tools')
  const stamp = tools.querySelector('.gt-updates__refresh-status')
  expect(
    stamp.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('the library sweep is its own control and refills the inbox', async () => {
  // Refresh re-reads the last probe; this makes a new probe happen. With only
  // Refresh, an inbox that was empty because nothing had ever been probed
  // stayed empty however many times you pressed it.
  const user = userEvent.setup()
  updatesApi.scanLibraryUpdates.mockResolvedValue({
    ok: true,
    checked: 25,
    behind_count: 2,
    behind: [],
    errors: [],
    remaining: 387,
  })

  render(
    <MemoryRouter>
      <UpdatesPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )
  await waitFor(() => expect(updatesApi.fetchUpdatesInbox).toHaveBeenCalled())
  const before = updatesApi.fetchUpdatesInbox.mock.calls.length

  await user.click(screen.getByRole('button', { name: /Check library for updates/i }))

  await waitFor(() => expect(updatesApi.scanLibraryUpdates).toHaveBeenCalled())
  // Says how much is left, so "press again" is a real instruction rather than
  // a guess about whether one press did the whole library.
  expect(await screen.findByText(/387 still to check/i)).toBeInTheDocument()
  await waitFor(() =>
    expect(updatesApi.fetchUpdatesInbox.mock.calls.length).toBeGreaterThan(before),
  )
})
