import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { searchGames } from '../api/collections'
import { openPreferencesModal } from '../api/preferences'
import {
  buildPaletteCommands,
  CommandPalette,
  isLibrarySearchRoute,
  typeToSearchKey,
} from './CommandPalette'

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

vi.mock('../api/collections', async () => {
  const actual = await vi.importActual('../api/collections')
  return {
    ...actual,
    searchGames: vi.fn(() => Promise.resolve([])),
  }
})

function renderPalette(shellConfig = {}, props = {}, initialEntries = ['/library']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CommandPalette shellConfig={shellConfig} {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  openPreferencesModal.mockClear()
  searchGames.mockReset()
  searchGames.mockResolvedValue([])
})

test('isLibrarySearchRoute matches library paths', () => {
  expect(isLibrarySearchRoute('/library')).toBe(true)
  expect(isLibrarySearchRoute('/library/')).toBe(true)
  expect(isLibrarySearchRoute('/discover')).toBe(false)
  expect(isLibrarySearchRoute('/game_details/abc')).toBe(false)
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
  renderPalette({ isAdmin: false }, {}, ['/discover'])

  expect(screen.queryByPlaceholderText(/search pages/i)).toBeNull()

  await user.keyboard('{Control>}k{/Control}')
  expect(screen.getByPlaceholderText(/search pages/i)).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByPlaceholderText(/search pages/i)).toBeNull()
})

test('on Library route uses Search library placeholder', async () => {
  const user = userEvent.setup()
  renderPalette({}, {})

  await user.keyboard('{Control>}k{/Control}')
  expect(screen.getByPlaceholderText(/search library/i)).toBeInTheDocument()
})

test('opens when open prop is true and filters by typeahead', async () => {
  const user = userEvent.setup()
  renderPalette({ isAdmin: true, showHelp: true }, { open: true }, ['/discover'])

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Library')).toBeInTheDocument()
  expect(within(dialog).getByText('Discover')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/search pages/i), 'chat')
  expect(within(dialog).getByText('Chat')).toBeInTheDocument()
  expect(within(dialog).queryByText('Library')).toBeNull()
})

test('Library mode searches titles via /api/search and navigates to details', async () => {
  const user = userEvent.setup()
  searchGames.mockResolvedValue([
    { uuid: 'game-1', name: 'Celeste' },
    { uuid: 'game-2', name: 'Celeste Classic' },
  ])

  renderPalette({}, { open: true })

  await user.type(screen.getByPlaceholderText(/search library/i), 'cel')

  await waitFor(() => {
    expect(searchGames).toHaveBeenCalled()
  })
  expect(searchGames.mock.calls.at(-1)[0]).toBe('cel')

  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByText('Celeste')).toBeInTheDocument()
  expect(within(dialog).getByText('Search library')).toBeInTheDocument()
  expect(within(dialog).getByText('Navigate')).toBeInTheDocument()

  await user.click(within(dialog).getByText('Celeste'))
  expect(navigateMock).toHaveBeenCalledWith('/game_details/game-1')
})

test('selecting a nav command navigates via useNavigate', async () => {
  const user = userEvent.setup()
  renderPalette({}, { open: true }, ['/discover'])

  await user.click(screen.getByText('Systems'))
  expect(navigateMock).toHaveBeenCalledWith('/systems')
})

test('friends command opens dock event instead of navigating', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  window.addEventListener('gt-open-social-companion', onOpen)
  try {
    const friends = buildPaletteCommands({}).find((c) => c.id === 'friends')
    expect(friends.action).toBe('open-friends')
    expect(friends.to).toBeUndefined()

    renderPalette({}, { open: true }, ['/discover'])
    await user.click(screen.getByText('Friends'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(navigateMock).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('gt-open-social-companion', onOpen)
  }
})

test('chat command opens slide-out event instead of navigating', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  window.addEventListener('gt-open-chat-panel', onOpen)
  try {
    const chat = buildPaletteCommands({}).find((c) => c.id === 'chat')
    expect(chat.action).toBe('open-chat')
    expect(chat.to).toBeUndefined()

    renderPalette({}, { open: true }, ['/discover'])
    await user.click(screen.getByText('Chat'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(navigateMock).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('gt-open-chat-panel', onOpen)
  }
})

test('preferences command opens preferences modal', async () => {
  const user = userEvent.setup()
  renderPalette({}, { open: true }, ['/discover'])

  await user.click(screen.getByText('Preferences'))
  expect(openPreferencesModal).toHaveBeenCalled()
})

test('admin external command uses location href', async () => {
  const user = userEvent.setup()
  const loc = { href: '/library' }
  vi.stubGlobal('location', loc)

  renderPalette({ isAdmin: true }, { open: true }, ['/discover'])
  await user.click(screen.getByText('Admin'))
  expect(loc.href).toBe('/admin/dashboard')

  vi.unstubAllGlobals()
})


describe('type-to-search', () => {
  const key = (k, extra = {}) => ({ key: k, target: document.body, ...extra })

  test('a printable key opens the palette and seeds it', () => {
    expect(typeToSearchKey(key('a'))).toBe(true)
    expect(typeToSearchKey(key('7'))).toBe(true)
    // Shift is not a chord — Shift+A is just "A".
    expect(typeToSearchKey(key('A', { shiftKey: true }))).toBe(true)
  })

  test('shortcuts and navigation keys are left alone', () => {
    // Ctrl+C must stay copy; Enter/Tab/Escape/arrows must keep working.
    expect(typeToSearchKey(key('c', { ctrlKey: true }))).toBe(false)
    expect(typeToSearchKey(key('c', { metaKey: true }))).toBe(false)
    expect(typeToSearchKey(key('c', { altKey: true }))).toBe(false)
    for (const k of ['Enter', 'Tab', 'Escape', 'ArrowDown', 'F5', 'Backspace']) {
      expect(typeToSearchKey(key(k))).toBe(false)
    }
    // Space scrolls; a palette that opens on scroll is unusable.
    expect(typeToSearchKey(key(' '))).toBe(false)
  })

  test('typing into a field is never hijacked', () => {
    // Without this the filter box and the chat composer would lose focus
    // mid-word to a palette the reader did not ask for.
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag)
      document.body.appendChild(el)
      expect(typeToSearchKey(key('a', { target: el }))).toBe(false)
      el.remove()
    }
    const rich = document.createElement('div')
    rich.setAttribute('contenteditable', 'true')
    document.body.appendChild(rich)
    expect(typeToSearchKey(key('a', { target: rich }))).toBe(false)
    rich.remove()
  })
})
