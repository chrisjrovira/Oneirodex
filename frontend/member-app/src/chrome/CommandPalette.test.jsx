import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { openPreferencesModal } from '../api/preferences'
import { buildPaletteCommands, CommandPalette } from './CommandPalette'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../api/preferences', async () => {
  const actual = await vi.importActual('../api/preferences')
  return {
    ...actual,
    openPreferencesModal: vi.fn(() => Promise.resolve()),
  }
})

function renderPalette(shellConfig = {}, props = {}) {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <CommandPalette shellConfig={shellConfig} {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  openPreferencesModal.mockClear()
})

test('buildPaletteCommands includes primary, more, and preferences', () => {
  const ids = buildPaletteCommands({
    isAdmin: true,
    showHelp: true,
    showTrailers: true,
    enableVr: true,
  }).map((c) => c.id)

  expect(ids).toContain('library')
  expect(ids).toContain('discover')
  expect(ids).toContain('systems')
  expect(ids).toContain('chat')
  expect(ids).toContain('friends')
  expect(ids).toContain('big-picture')
  expect(ids).toContain('admin')
  expect(ids).toContain('help')
  expect(ids).toContain('preferences')
  expect(new Set(ids).size).toBe(ids.length)
})

test('hides admin and help when flags are off', () => {
  const ids = buildPaletteCommands({ isAdmin: false, showHelp: false }).map((c) => c.id)
  expect(ids).not.toContain('admin')
  expect(ids).not.toContain('help')
})

test('opens with Ctrl+K and closes with Escape', async () => {
  const user = userEvent.setup()
  renderPalette({ isAdmin: false })

  expect(screen.queryByPlaceholderText(/search pages/i)).toBeNull()

  await user.keyboard('{Control>}k{/Control}')
  expect(screen.getByPlaceholderText(/search pages/i)).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByPlaceholderText(/search pages/i)).toBeNull()
})

test('opens when open prop is true and filters by typeahead', async () => {
  const user = userEvent.setup()
  renderPalette({ isAdmin: true, showHelp: true }, { open: true })

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Library')).toBeInTheDocument()
  expect(within(dialog).getByText('Discover')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/search pages/i), 'chat')
  expect(within(dialog).getByText('Chat')).toBeInTheDocument()
  expect(within(dialog).queryByText('Library')).toBeNull()
})

test('selecting a nav command navigates via useNavigate', async () => {
  const user = userEvent.setup()
  renderPalette({}, { open: true })

  await user.click(screen.getByText('Systems'))
  expect(navigateMock).toHaveBeenCalledWith('/systems')
})

test('preferences command opens preferences modal', async () => {
  const user = userEvent.setup()
  renderPalette({}, { open: true })

  await user.click(screen.getByText('Preferences'))
  expect(openPreferencesModal).toHaveBeenCalled()
})

test('admin external command uses location href', async () => {
  const user = userEvent.setup()
  const loc = { href: '/library' }
  vi.stubGlobal('location', loc)

  renderPalette({ isAdmin: true }, { open: true })
  await user.click(screen.getByText('Admin'))
  expect(loc.href).toBe('/admin/dashboard')

  vi.unstubAllGlobals()
})
