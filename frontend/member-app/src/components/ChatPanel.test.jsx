import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from './ChatPanel'

function jsonOk(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function baseFetch({
  messages,
  attachStatus = 404,
  channels = [{ id: 1, name: 'household', kind: 'channel', slug: 'household' }],
} = {}) {
  const msgPayload =
    messages ||
    [
      {
        id: 10,
        body: 'Hello household',
        user: 'Alex',
        created_at: '2026-07-27T12:00:00Z',
        reactions: {},
        mine: [],
      },
    ]
  return vi.fn(async (input, init) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    if (url.includes('/api/chat/emoji')) {
      return jsonOk({ fixed: ['👍', '❤️', '😂'], custom: [] })
    }
    if (/\/api\/chat\/channels\/\d+\/attachments/.test(url)) {
      if (method === 'OPTIONS') return { ok: false, status: attachStatus, json: async () => ({}) }
      return {
        ok: attachStatus >= 200 && attachStatus < 300,
        status: attachStatus,
        json: async () =>
          attachStatus === 404
            ? { error: 'Not found' }
            : {
                attachment: {
                  id: 99,
                  url: '/media/chat/shot.png',
                  filename: 'shot.png',
                  content_type: 'image/png',
                },
              },
      }
    }
    if (/\/api\/chat\/channels\/\d+\/messages/.test(url)) {
      return jsonOk({ messages: msgPayload })
    }
    if (url.includes('/api/chat/channels') && !url.includes('/messages')) {
      return jsonOk({ channels })
    }
    if (url.includes('/api/rtc/status')) {
      return jsonOk({ enabled: true })
    }
    if (url.includes('/api/rtc/token')) {
      return jsonOk({ room: 'household:lobby', url: 'wss://livekit.example' })
    }
    return jsonOk({})
  })
}

beforeEach(() => {
  try {
    localStorage?.clear?.()
  } catch {
    // ignore
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('composer shows attach button and soft-disables when upload 404', async () => {
  vi.stubGlobal('fetch', baseFetch({ attachStatus: 404 }))
  render(<ChatPanel />)

  expect(await screen.findByRole('button', { name: /household/i })).toBeInTheDocument()
  const attach = await screen.findByRole('button', { name: /attach file/i })
  await waitFor(() => {
    expect(attach).toBeDisabled()
  })
  expect(await screen.findByText(/file attach isn’t available yet/i)).toBeInTheDocument()
})

test('renders image attachment thumb and file download link', async () => {
  vi.stubGlobal(
    'fetch',
    baseFetch({
      attachStatus: 404,
      messages: [
        {
          id: 11,
          body: 'See this',
          user: 'Alex',
          created_at: '2026-07-27T12:00:00Z',
          reactions: {},
          mine: [],
          attachments: [
            {
              id: 1,
              url: '/media/chat/cover.png',
              filename: 'cover.png',
              content_type: 'image/png',
            },
            {
              id: 2,
              url: '/media/chat/notes.txt',
              filename: 'notes.txt',
              content_type: 'text/plain',
            },
          ],
        },
      ],
    }),
  )
  render(<ChatPanel />)

  expect(await screen.findByText('See this')).toBeInTheDocument()
  const attachments = screen.getByRole('list', { name: /attachments/i })
  expect(within(attachments).getByAltText(/cover\.png/i)).toBeInTheDocument()
  expect(within(attachments).getByRole('link', { name: /open image/i })).toHaveAttribute(
    'href',
    '/media/chat/cover.png',
  )
  expect(within(attachments).getByRole('link', { name: /notes\.txt/i })).toHaveAttribute(
    'href',
    '/media/chat/notes.txt',
  )
})

test('room header exposes Voice and Screenshare entry without Discord branding', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', baseFetch({ attachStatus: 404 }))
  const { container } = render(<ChatPanel />)

  expect(await screen.findByRole('button', { name: /^voice$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^screenshare$/i })).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/discord/i)

  await user.click(screen.getByRole('button', { name: /^screenshare$/i }))
  expect(await screen.findByText(/screenshare entry/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/request screenshare/i)).toBeChecked()
})

test('emoji picker inserts into composer', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('fetch', baseFetch({ attachStatus: 404 }))
  render(<ChatPanel />)

  expect(await screen.findByPlaceholderText(/message household/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /insert emoji/i }))
  const picker = await screen.findByRole('listbox', { name: /emoji/i })
  await user.click(within(picker).getByRole('option', { name: '👍' }))
  expect(screen.getByPlaceholderText(/message household/i)).toHaveValue('👍')
})
