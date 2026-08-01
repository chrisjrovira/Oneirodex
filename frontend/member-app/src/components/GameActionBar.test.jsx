import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameActionBar } from './GameActionBar'
import * as clientCommands from '../api/clientCommands'
import * as downloadsApi from '../api/downloads'
import { showToast } from '../utils/toast'

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(),
}))

vi.mock('../api/downloads', () => ({
  initiateGameDownload: vi.fn(),
}))

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

vi.mock('../api/assists', () => ({
  fetchGameAssists: vi.fn().mockResolvedValue({ enabled: false, pack: null }),
}))

vi.mock('../api/remotePlay', () => ({
  fetchRemotePlayStatus: vi.fn().mockResolvedValue({ enabled: false, configured: false }),
}))

beforeEach(() => {
  clientCommands.queueClientCommand.mockReset()
  downloadsApi.initiateGameDownload.mockReset()
  showToast.mockReset()
})

test('Download queues via API; Install explains when companion offline', async () => {
  const user = userEvent.setup()
  downloadsApi.initiateGameDownload.mockResolvedValue({ download_id: 1, status: 'available' })
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      lifecycleState="not_downloaded"
      assistPack={null}
    />,
  )
  expect(screen.getByRole('button', { name: /^Download$/i })).toBeInTheDocument()
  expect(screen.getByText(/companion offline/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Download$/i }))
  await waitFor(() => {
    expect(downloadsApi.initiateGameDownload).toHaveBeenCalledWith('abc')
  })
  expect(assign).toHaveBeenCalledWith('/downloads')
  await user.click(screen.getByRole('button', { name: /^Install$/i }))
  expect(await screen.findByRole('status')).toHaveTextContent(/companion/i)
  expect(clientCommands.queueClientCommand).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('Download toasts Backend hint on 410 path_missing', async () => {
  const user = userEvent.setup()
  const err = new Error('Version file is missing on disk')
  err.status = 410
  err.code = 'path_missing'
  err.hint = 'This install path is gone. Use Remove missing versions.'
  err.data = { code: 'path_missing', hint: err.hint }
  downloadsApi.initiateGameDownload.mockRejectedValue(err)

  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      lifecycleState="not_downloaded"
      assistPack={null}
    />,
  )
  await user.click(screen.getByRole('button', { name: /^Download$/i }))
  await waitFor(() => {
    expect(showToast).toHaveBeenCalledWith(
      'This install path is gone. Use Remove missing versions.',
      'error',
    )
  })
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
