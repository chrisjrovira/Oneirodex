import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpenPathModal } from './OpenPathModal'
import { queueClientCommand } from '../api/clientCommands'

vi.mock('../api/clientCommands', () => ({
  queueClientCommand: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

beforeEach(() => {
  queueClientCommand.mockReset()
  queueClientCommand.mockResolvedValue({})
})

test('OpenPathModal copies path and queues companion open_path', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const path = '/games/Celeste'

  render(
    <OpenPathModal
      open
      path={path}
      label="Library folder"
      gameUuid="game-1"
      clientConnected
      matchReason="Duplicate folder"
      onClose={onClose}
    />,
  )

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('heading', { name: 'Library folder' })).toBeInTheDocument()
  expect(within(dialog).getByText(path)).toBeInTheDocument()
  expect(within(dialog).getByText(/Duplicate folder/)).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Copy path' }))
  expect(await within(dialog).findByText(/Path copied to clipboard|Unable to copy path/i)).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Open in file explorer' }))
  expect(queueClientCommand).toHaveBeenCalledWith('game-1', 'open_path', {
    path,
    select: true,
  })
  expect(await within(dialog).findByText(/Queued open in file explorer/i)).toBeInTheDocument()
})

test('OpenPathModal falls back when companion offline', async () => {
  const user = userEvent.setup()
  const path = '/mnt/games/foo'

  render(
    <OpenPathModal open path={path} clientConnected={false} onClose={() => {}} />,
  )

  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Open in file explorer' }))
  expect(queueClientCommand).not.toHaveBeenCalled()
  expect(
    await within(dialog).findByText(/Companion offline|path copied|Unable to open/i),
  ).toBeInTheDocument()
})
