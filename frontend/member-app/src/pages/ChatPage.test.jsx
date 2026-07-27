import { render, screen, waitFor } from '@testing-library/react'
import { ChatPage } from './ChatPage'

beforeEach(() => {
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
            channels: [{ id: 1, name: 'household', kind: 'household' }],
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
})

test('chat page loads channels and messages', async () => {
  render(<ChatPage />)

  await waitFor(() => {
    expect(screen.getByText(/household/i)).toBeInTheDocument()
  })
  expect(await screen.findByText('Hello household')).toBeInTheDocument()
  expect(screen.getByText('Alex')).toBeInTheDocument()
})
