import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameActionBar } from './GameActionBar'
import * as clientCommands from '../api/clientCommands'

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(),
}))

vi.mock('../api/assists', () => ({
  fetchGameAssists: vi.fn().mockResolvedValue({ enabled: false, pack: null }),
}))

beforeEach(() => {
  clientCommands.queueClientCommand.mockReset()
})

test('Download is always available; Install gated without client', () => {
  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      lifecycleState="not_downloaded"
      assistPack={null}
    />,
  )
  expect(screen.getByRole('link', { name: /^Download$/i })).toHaveAttribute(
    'href',
    '/download_game/abc',
  )
  expect(screen.getByRole('button', { name: /^Install$/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /^Uninstall$/i })).toBeDisabled()
})

test('Install enabled when companion client connected and downloaded', () => {
  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      clientConnected
      lifecycleState="downloaded"
      assistPack={null}
    />,
  )
  expect(screen.getByRole('button', { name: /^Install$/i })).not.toBeDisabled()
})

test('Install click queues companion command', async () => {
  const user = userEvent.setup()
  clientCommands.queueClientCommand.mockResolvedValue({ ok: true })

  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      clientConnected
      lifecycleState="downloaded"
      assistPack={null}
    />,
  )

  await user.click(screen.getByRole('button', { name: /^Install$/i }))

  await waitFor(() => {
    expect(clientCommands.queueClientCommand).toHaveBeenCalledWith('abc', 'install')
  })
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Install queued for companion',
  )
})

test('Assists button shows when pack has toggles', () => {
  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      assistPack={{
        title: 'Demo Assists',
        policy: 'single_player_offline_only',
        toggles: [{ id: 'god', label: 'God mode' }],
      }}
    />,
  )
  expect(screen.getByRole('button', { name: /^Assists$/i })).toBeInTheDocument()
})
