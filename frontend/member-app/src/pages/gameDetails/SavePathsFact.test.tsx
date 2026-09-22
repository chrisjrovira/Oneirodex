import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SavePathsFact } from './SavePathsFact'

const PATHS = [
  { path: '<winAppData>/StardewValley/Saves', os: 'windows', store: 'steam' },
  { path: '<winAppData>/StardewValley/Saves', os: 'windows', store: 'gog' },
  { path: '<xdgConfig>/StardewValley/Saves', os: 'linux', store: null },
]

test('lists each save location once per os with its chips; the companion button only when connected', async () => {
  const onOpen = vi.fn()
  const first = render(<SavePathsFact paths={PATHS} canOpen={false} onOpen={onOpen} />)
  expect(screen.getAllByText('<winAppData>/StardewValley/Saves')).toHaveLength(1)
  expect(screen.getByText('Windows')).toBeInTheDocument()
  expect(screen.getByText('Linux')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Open save folder' })).toBeNull()
  expect(screen.getByText(/the folder, not a backup/)).toBeInTheDocument()
  first.unmount()

  render(<SavePathsFact paths={PATHS} canOpen onOpen={onOpen} />)
  const buttons = screen.getAllByRole('button', { name: 'Open save folder' })
  expect(buttons).toHaveLength(1) // the Windows row only; a companion is a Windows PC here
  await userEvent.setup().click(buttons[0])
  expect(onOpen).toHaveBeenCalledWith('<winAppData>/StardewValley/Saves')
})
