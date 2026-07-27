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

vi.mock('../api/remotePlay', () => ({
  fetchRemotePlayStatus: vi.fn().mockResolvedValue({ enabled: false, configured: false }),
}))

beforeEach(() => {
  clientCommands.queueClientCommand.mockReset()
})

test('Download is always available; Install explains when companion offline', async () => {
  const user = userEvent.setup()
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
  expect(screen.getByText(/companion offline/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Install$/i }))
  expect(await screen.findByRole('status')).toHaveTextContent(/companion/i)
  expect(clientCommands.queueClientCommand).not.toHaveBeenCalled()
})

test('Get with companion queues download when connected and not downloaded', async () => {
  const user = userEvent.setup()
  clientCommands.queueClientCommand.mockResolvedValue({ ok: true })
  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      clientConnected
      lifecycleState="not_downloaded"
      assistPack={null}
    />,
  )
  await user.click(screen.getByRole('button', { name: /Get with companion/i }))
  await waitFor(() => {
    expect(clientCommands.queueClientCommand).toHaveBeenCalledWith('abc', 'download')
  })
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
  expect(screen.getByRole('button', { name: /^Install$/i })).toBeInTheDocument()
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
      remotePlay={null}
    />,
  )
  expect(screen.getByRole('button', { name: /^Assists$/i })).toBeInTheDocument()
})

test('Play via Moonlight copies host hint when remote play configured', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      assistPack={null}
      remotePlay={{
        enabled: true,
        configured: true,
        moonlight_host: '192.168.1.50',
        moonlight_port: 47989,
        copy_hint: 'GPU PC — 192.168.1.50:47989 — App: Steam',
      }}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Play via Moonlight/i }))
  expect(writeText).toHaveBeenCalledWith('GPU PC — 192.168.1.50:47989 — App: Steam')
  expect(await screen.findByRole('status')).toHaveTextContent(/Copied Moonlight host/i)
  vi.unstubAllGlobals()
})
