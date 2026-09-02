import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SocialCompanionDock } from './SocialCompanionDock'

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
      if (url.includes('/api/social/friends')) {
        return {
          ok: true,
          json: async () => ({
            friends: [
              {
                id: 1,
                status: 'accepted',
                direction: 'outgoing',
                user: {
                  id: 9,
                  name: 'Alex',
                  presence: { status: 'online', game_uuid: null, game_name: null },
                },
              },
            ],
          }),
        }
      }
      if (url.includes('/api/social/status')) {
        return {
          ok: true,
          json: async () => ({ friend_count: 1, pending_incoming: 0, now_playing: [], presence: [] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    }),
  )
  globalThis.__odEventSourceCalls = []
  vi.stubGlobal(
    'EventSource',
    class {
      constructor(url) {
        globalThis.__odEventSourceCalls.push(url)
        this.url = url
        this.addEventListener = () => {}
        this.close = () => {}
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('dock shows friends with gaming actions', async () => {
  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" gameUuid="game-1" defaultOpen />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Alex')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^DM$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Party$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Share$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /pop out/i })).toBeInTheDocument()
})

test('launcher opens collapsed dock', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" defaultOpen={false} />
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: /open friends companion/i }))
  await waitFor(() => {
    expect(screen.getByLabelText(/friends companion/i)).toBeInTheDocument()
  })
})

test('od-open-social-companion event opens the dock', async () => {
  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" defaultOpen={false} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: /open friends companion/i })).toBeInTheDocument()
  window.dispatchEvent(new CustomEvent('od-open-social-companion'))
  await waitFor(() => {
    expect(screen.getByLabelText(/friends companion/i)).toBeInTheDocument()
  })
})

test('closed dock never opens activity EventSource', async () => {
  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" defaultOpen={false} />
    </MemoryRouter>,
  )
  await screen.findByRole('button', { name: /open friends companion/i })
  await new Promise((resolve) => setTimeout(resolve, 1700))
  expect(globalThis.__odEventSourceCalls || []).toHaveLength(0)
})

test('open dock connects activity EventSource after defer', async () => {
  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" defaultOpen />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Alex')).toBeInTheDocument()
  await waitFor(
    () => {
      expect(globalThis.__odEventSourceCalls).toContain('/api/activity/stream')
    },
    { timeout: 2500 },
  )
})

test('failed friends load uses PageStatus with Retry', async () => {
  const user = userEvent.setup()
  let failFriends = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/api/social/friends')) {
        if (failFriends) {
          throw new Error('network')
        }
        return {
          ok: true,
          json: async () => ({
            friends: [
              {
                id: 1,
                status: 'accepted',
                direction: 'outgoing',
                user: {
                  id: 9,
                  name: 'Alex',
                  presence: { status: 'online', game_uuid: null, game_name: null },
                },
              },
            ],
          }),
        }
      }
      if (url.includes('/api/social/status')) {
        return {
          ok: true,
          json: async () => ({ friend_count: 1, pending_incoming: 0, now_playing: [], presence: [] }),
        }
      }
      return { ok: false, json: async () => ({}) }
    }),
  )

  render(
    <MemoryRouter>
      <SocialCompanionDock mode="dock" defaultOpen />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load friends.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

  failFriends = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Alex')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
