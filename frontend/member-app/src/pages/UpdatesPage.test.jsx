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
  await user.click(screen.getByRole('button', { name: /^Refresh$/i }))
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

test('new chrome moves refresh and its status into bar two', async () => {
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
  // make a stale inbox indistinguishable from a fresh one.
  //
  // The control is a symbol on the inbox heading now rather than a word in bar
  // two, so its accessible name is the one the tooltip carries. Queried by
  // role+name precisely so the icon cannot ship without one.
  const refresh = await screen.findByRole('button', {
    name: 'Refresh the freshness inbox',
  })
  await user.click(refresh)
  await waitFor(() => expect(screen.getByText(/^Updated /)).toBeInTheDocument())
})
