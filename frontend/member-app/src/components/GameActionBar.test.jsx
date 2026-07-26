import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameActionBar } from './GameActionBar'
import * as clientCommands from '../api/clientCommands'

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(),
}))

beforeEach(() => {
  clientCommands.queueClientCommand.mockReset()
})

test('Download is always available; Install gated without client', () => {
  render(
    <GameActionBar gameUuid="abc" gameName="Demo" lifecycleState="not_downloaded" />,
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
