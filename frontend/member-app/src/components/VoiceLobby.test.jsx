import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceLobby } from './VoiceLobby'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
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

test('shows disabled voice messaging when LiveKit is off', async () => {
  render(<VoiceLobby />)

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Voice lobby' })).toBeInTheDocument()
  })
  expect(screen.getByText(/voice is on by default/i)).toBeInTheDocument()
  expect(screen.getByText(/livekit_url/i)).toBeInTheDocument()
  expect(screen.getByText(/chat and friends work without it/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /get voice token/i })).not.toBeInTheDocument()
})

test('compact mode hides disabled lobby entirely', async () => {
  const { container } = render(<VoiceLobby compact />)

  await waitFor(() => {
    expect(vi.mocked(fetch)).toHaveBeenCalled()
  })
  expect(container).toBeEmptyDOMElement()
})

test('token failure uses PageStatus', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('/api/rtc/status')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      if (url.includes('/api/rtc/token')) {
        return { ok: false, status: 500, json: async () => ({ error: 'Token failed' }) }
      }
      return { ok: true, json: async () => ({}) }
    }),
  )

  render(<VoiceLobby />)
  await user.click(await screen.findByRole('button', { name: /get voice token/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Token failed')
})
