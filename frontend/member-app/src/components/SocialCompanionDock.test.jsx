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
