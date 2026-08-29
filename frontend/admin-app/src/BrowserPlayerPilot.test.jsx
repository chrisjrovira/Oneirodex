import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { BrowserPlayerPilot } from './BrowserPlayerPilot'
import { showToast } from './utils/toast'

vi.mock('./utils/toast', () => ({
  showToast: vi.fn(),
}))

function mockSettings({ getPilot = false, putOk = true } = {}) {
  global.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    if (!String(url).includes('/api/browser-player-settings')) {
      return { ok: false, status: 404, json: async () => ({}) }
    }
    if (method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          nostalgist_nes_pilot: getPilot,
          browser_player_default: 'webretro',
          browser_players_available: ['webretro'],
        }),
      }
    }
    if (method === 'PUT') {
      const body = JSON.parse(init.body || '{}')
      if (!putOk) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, error: 'not wired' }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          nostalgist_nes_pilot: Boolean(body.nostalgist_nes_pilot),
        }),
      }
    }
    return { ok: false, status: 405, json: async () => ({}) }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('checkbox is off when the flag is off', async () => {
  mockSettings({ getPilot: false })
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText('NES Nostalgist pilot')
  expect(box).not.toBeChecked()
  expect(screen.getByText(/does not yet have Save \/ Load \/ Rewind/i)).toBeInTheDocument()
})

test('toggling on PUTs nostalgist_nes_pilot true', async () => {
  mockSettings({ getPilot: false })
  const user = userEvent.setup()
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText('NES Nostalgist pilot')
  await user.click(box)
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/browser-player-settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ nostalgist_nes_pilot: true }),
      }),
    )
  })
  expect(showToast).toHaveBeenCalled()
})
