import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UpdatesPage } from './UpdatesPage'
import * as updatesApi from '../api/updates'
import * as clientCommands from '../api/clientCommands'

vi.mock('../api/updates', () => ({
  fetchUpdatesInbox: vi.fn(),
  fetchStoreSearch: vi.fn(),
}))

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(),
}))

beforeEach(() => {
  updatesApi.fetchUpdatesInbox.mockReset()
  updatesApi.fetchStoreSearch.mockReset()
  clientCommands.queueClientCommand.mockReset()
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
  expect(await screen.findByRole('status')).toHaveTextContent(/queued for companion/i)
})
