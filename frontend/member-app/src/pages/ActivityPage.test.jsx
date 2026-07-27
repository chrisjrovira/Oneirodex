import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityPage } from './ActivityPage'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/api/activity')) {
        return {
          ok: true,
          json: async () => ({
            now_playing: [],
            activity: [],
            restricted: false,
          }),
        }
      }
      if (url.includes('/api/social/status')) {
        return {
          ok: true,
          json: async () => ({
            friend_count: 0,
            pending_incoming: 0,
            now_playing: [],
            presence: [],
          }),
        }
      }
      if (url.includes('/api/social/friends')) {
        return { ok: true, json: async () => ({ friends: [] }) }
      }
      if (url.includes('/api/rtc/status')) {
        return { ok: true, json: async () => ({ enabled: false }) }
      }
      return { ok: true, json: async () => ({}) }
    }),
  )
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener() {}
      close() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('activity page renders friends, feed chrome, and voice lobby', async () => {
  render(
    <MemoryRouter>
      <ActivityPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument()
  expect(screen.getByText(/friends only feed/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Friends' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/household username/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /request/i })).toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Now playing' })).toBeInTheDocument()
  })
  expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Voice lobby' })).toBeInTheDocument()
  expect(screen.getByText(/nobody is playing right now/i)).toBeInTheDocument()
})
