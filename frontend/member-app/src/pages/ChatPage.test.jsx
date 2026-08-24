import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ChatPage, ChatPanel } from './ChatPage'

beforeEach(() => {
  try {
    localStorage?.clear?.()
  } catch {
    // ignore
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/api/chat/emoji')) {
        return {
          ok: true,
          json: async () => ({ fixed: ['👍', '❤️'], custom: [] }),
        }
      }
      if (/\/api\/chat\/channels\/\d+\/messages/.test(url)) {
        return {
          ok: true,
          json: async () => ({
            messages: [
              {
                id: 10,
                body: 'Hello household',
                user: 'Alex',
                created_at: '2026-07-27T12:00:00Z',
                reactions: {},
                mine: [],
              },
            ],
          }),
        }
      }
      if (url.includes('/api/chat/channels')) {
        return {
          ok: true,
          json: async () => ({
            channels: [{ id: 1, name: 'household', kind: 'channel' }],
          }),
        }
      }
      if (url.includes('/api/rtc/status')) {
        return { ok: true, json: async () => ({ enabled: false }) }
      }
      if (/\/api\/chat\/channels\/\d+\/attachments/.test(url)) {
        return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) }
      }
      return { ok: true, json: async () => ({}) }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('chat panel loads channels and messages', async () => {
  render(<ChatPanel />)

  expect(await screen.findByRole('button', { name: /household/i })).toBeInTheDocument()
  expect(await screen.findByText('Hello household')).toBeInTheDocument()
  expect(screen.getByText('Alex')).toBeInTheDocument()
})

test('/chat deep-link opens chat event and redirects to library', async () => {
  const onOpen = vi.fn()
  window.addEventListener('gt-open-chat-panel', onOpen)
  try {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/library" element={<div>LibraryPage</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalled()
      expect(screen.getByText('LibraryPage')).toBeInTheDocument()
    })
  } finally {
    window.removeEventListener('gt-open-chat-panel', onOpen)
  }
})

test('the pop-out renders chat alone, with no redirect to the library', async () => {
  // The regression this pins: ChatPage redirected unconditionally, and
  // `navigate('/library')` drops the query string — so `?popout=1` was lost,
  // the shell stopped treating the window as chrome-less, and a 420px pop-out
  // rendered the rail, the top bar and the library grid with chat sliding over
  // them. "A minimised version of the whole site."
  const onOpen = vi.fn()
  window.addEventListener('gt-open-chat-panel', onOpen)
  const original = window.location.search
  try {
    // jsdom's location is not writable; the module reads window.location.search
    // directly, so redefining just that property is enough and is reversible.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?popout=1&channel=1' },
    })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/library" element={<div>LibraryPage</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: /household/i })).toBeInTheDocument()
    expect(screen.queryByText('LibraryPage')).not.toBeInTheDocument()
    // No slide-out request either: the window *is* the chat, so asking the
    // (absent) panel to open would be asking the main window to open a second.
    expect(onOpen).not.toHaveBeenCalled()
    expect(document.querySelector('.gt-chat-standalone')).not.toBeNull()
  } finally {
    window.removeEventListener('gt-open-chat-panel', onOpen)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: original },
    })
  }
})
