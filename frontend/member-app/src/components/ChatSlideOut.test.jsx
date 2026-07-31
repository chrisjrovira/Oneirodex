import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatSlideOut } from './ChatSlideOut'

beforeEach(() => {
  try {
    localStorage?.clear?.()
  } catch {
    // jsdom may lack localStorage
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
      if (url.includes('/api/chat/channels') && !url.includes('/messages')) {
        return {
          ok: true,
          json: async () => ({
            channels: [
              { id: 1, name: 'household', kind: 'channel', slug: 'household' },
              { id: 2, name: 'Alex', kind: 'dm' },
            ],
          }),
        }
      }
      if (url.includes('/api/rtc/status')) {
        return { ok: true, json: async () => ({ enabled: false }) }
      }
      return { ok: true, json: async () => ({}) }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('launcher opens left chat slide-out with room list', async () => {
  const user = userEvent.setup()
  render(<ChatSlideOut defaultOpen={false} />)

  await user.click(screen.getByRole('button', { name: /open chat/i }))
  expect(await screen.findByRole('dialog', { name: /chat/i })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /household/i })).toBeInTheDocument()
  expect(await screen.findByText('Hello household')).toBeInTheDocument()
})

test('gt-open-chat-panel event opens slide-out', async () => {
  render(<ChatSlideOut defaultOpen={false} />)
  expect(screen.getByRole('button', { name: /open chat/i })).toBeInTheDocument()
  window.dispatchEvent(new CustomEvent('gt-open-chat-panel'))
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: /chat/i })).toBeInTheDocument()
  })
})

test('close dismisses slide-out and shows launcher again', async () => {
  const user = userEvent.setup()
  render(<ChatSlideOut defaultOpen />)

  expect(await screen.findByRole('dialog', { name: /chat/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /hide chat/i }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /chat/i })).not.toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: /open chat/i })).toBeInTheDocument()
})

test('create room posts to channels API', async () => {
  const user = userEvent.setup()
  const fetchMock = globalThis.fetch
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.includes('/api/chat/emoji')) {
      return { ok: true, json: async () => ({ fixed: ['👍'], custom: [] }) }
    }
    if (url === '/api/chat/channels' && init?.method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          channel: { id: 9, name: 'party', kind: 'channel', slug: 'party' },
        }),
      }
    }
    if (/\/api\/chat\/channels\/\d+\/messages/.test(url)) {
      return { ok: true, json: async () => ({ messages: [] }) }
    }
    if (url.includes('/api/chat/channels')) {
      return {
        ok: true,
        json: async () => ({
          channels: [{ id: 1, name: 'household', kind: 'channel', slug: 'household' }],
        }),
      }
    }
    if (url.includes('/api/rtc/status')) {
      return { ok: true, json: async () => ({ enabled: false }) }
    }
    return { ok: true, json: async () => ({}) }
  })

  render(<ChatSlideOut defaultOpen />)
  expect(await screen.findByPlaceholderText(/new room/i)).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText(/new room/i), 'party')
  await user.click(screen.getByRole('button', { name: /^add$/i }))

  await waitFor(() => {
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/api/chat/channels') && init?.method === 'POST',
    )
    expect(post).toBeTruthy()
    expect(JSON.parse(post[1].body)).toMatchObject({ name: 'party', slug: 'party' })
  })
})

function mockChatFetch({ channels, onArchive, onLeave } = {}) {
  let list = channels || [
    { id: 1, name: 'household', kind: 'channel', slug: 'household', created_by_user_id: 9 },
    { id: 2, name: 'Alex', kind: 'dm' },
  ]
  return vi.fn(async (input, init) => {
    const url = String(input)
    if (url.includes('/api/chat/emoji')) {
      return { ok: true, json: async () => ({ fixed: ['👍'], custom: [] }) }
    }
    if (/\/api\/chat\/channels\/\d+\/messages/.test(url)) {
      return { ok: true, json: async () => ({ messages: [] }) }
    }
    if (/\/api\/chat\/channels\/\d+\/archive/.test(url) && init?.method === 'POST') {
      if (onArchive) return onArchive(url, init)
      list = list.filter((c) => c.id !== 1)
      return { ok: true, json: async () => ({ ok: true, archived: true, channel_id: 1 }) }
    }
    if (/\/api\/chat\/channels\/\d+\/leave/.test(url) && init?.method === 'POST') {
      if (onLeave) return onLeave(url, init)
      list = list.filter((c) => c.id !== 2)
      return { ok: true, json: async () => ({ ok: true, left: true, channel_id: 2 }) }
    }
    if (url.includes('/api/chat/channels') && !url.includes('/messages')) {
      return { ok: true, json: async () => ({ channels: list }) }
    }
    if (url.includes('/api/rtc/status')) {
      return { ok: true, json: async () => ({ enabled: false }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

test('archive posts to archive API and refreshes room list', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const fetchMock = mockChatFetch()
  vi.stubGlobal('fetch', fetchMock)

  render(<ChatSlideOut defaultOpen viewer={{ isLibrarian: true }} />)
  expect(await screen.findByRole('button', { name: /^archive$/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^archive$/i }))

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).includes('/api/chat/channels/1/archive') && init?.method === 'POST',
      ),
    ).toBe(true)
  })
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /household/i })).not.toBeInTheDocument()
  })
})

test('archive surfaces 403 error honestly', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const fetchMock = mockChatFetch({
    onArchive: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Not allowed to archive this channel' }),
    }),
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<ChatSlideOut defaultOpen viewer={{ userId: 9 }} />)
  await user.click(await screen.findByRole('button', { name: /^archive$/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/not allowed to archive/i)
})

test('leave DM posts to leave API and refreshes list', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const fetchMock = mockChatFetch()
  vi.stubGlobal('fetch', fetchMock)

  render(<ChatSlideOut defaultOpen viewer={{ userId: 9 }} />)
  await user.click(await screen.findByRole('button', { name: /^alex$/i }))
  expect(await screen.findByRole('button', { name: /^leave$/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^leave$/i }))

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).includes('/api/chat/channels/2/leave') && init?.method === 'POST',
      ),
    ).toBe(true)
  })
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /^alex$/i })).not.toBeInTheDocument()
  })
})

test('leave household channel refreshes list and shows muted badge', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  let list = [
    { id: 1, name: 'household', kind: 'channel', slug: 'household', muted: false },
    { id: 2, name: 'Alex', kind: 'dm' },
  ]
  const fetchMock = vi.fn(async (input, init) => {
    const url = String(input)
    if (url.includes('/api/chat/emoji')) {
      return { ok: true, json: async () => ({ fixed: ['👍'], custom: [] }) }
    }
    if (/\/api\/chat\/channels\/\d+\/messages/.test(url)) {
      return { ok: true, json: async () => ({ messages: [] }) }
    }
    if (/\/api\/chat\/channels\/\d+\/leave/.test(url) && init?.method === 'POST') {
      list = list.map((c) => (c.id === 1 ? { ...c, muted: true } : c))
      return { ok: true, json: async () => ({ ok: true, left: true, channel_id: 1, muted: true }) }
    }
    if (url.includes('/api/chat/channels') && !url.includes('/messages')) {
      return { ok: true, json: async () => ({ channels: list }) }
    }
    if (url.includes('/api/rtc/status')) {
      return { ok: true, json: async () => ({ enabled: false }) }
    }
    return { ok: true, json: async () => ({}) }
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<ChatSlideOut defaultOpen viewer={{ userId: 3 }} />)
  expect(await screen.findByRole('button', { name: /household/i })).toBeInTheDocument()
  expect(screen.queryByText('muted')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^leave$/i }))

  await waitFor(() => {
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).includes('/api/chat/channels/1/leave') && init?.method === 'POST',
      ),
    ).toBe(true)
  })
  expect(await screen.findByText('muted')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /household/i })).toBeInTheDocument()
})
