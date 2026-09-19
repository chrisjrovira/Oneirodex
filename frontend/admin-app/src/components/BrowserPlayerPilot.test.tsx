import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { BrowserPlayerPilot } from './BrowserPlayerPilot'
import { showToast } from '../utils/toast'

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

function mockSettings({
  getPilot = false,
  putOk = true,
  available = ['webretro'],
  memberChoice = false,
} = {}) {
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    if (!String(url).includes('/api/browser-player-settings')) {
      return {
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),

        text: async function () {
          return JSON.stringify(await this.json())
        },
        json: async () => ({}),
      }
    }
    if (method === 'GET') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),

        text: async function () {
          return JSON.stringify(await this.json())
        },
        json: async () => ({
          ok: true,
          nostalgist_nes_pilot: getPilot,
          browser_player_default: 'webretro',
          browser_player_allow_member_choice: memberChoice,
          browser_players_available: available,
        }),
      }
    }
    if (method === 'PUT') {
      const body = JSON.parse(init.body || '{}')
      if (!putOk) {
        return {
          ok: false,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),

          text: async function () {
            return JSON.stringify(await this.json())
          },
          json: async () => ({ ok: false, error: 'not wired' }),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),

        text: async function () {
          return JSON.stringify(await this.json())
        },
        json: async () => ({
          ok: true,
          nostalgist_nes_pilot: Boolean(body.nostalgist_nes_pilot),
          browser_player_default: body.browser_player_default || 'webretro',
          browser_player_allow_member_choice: Boolean(body.browser_player_allow_member_choice),
          browser_players_available: available,
        }),
      }
    }
    return {
      ok: false,
      status: 405,
      headers: new Headers({ 'content-type': 'application/json' }),

      text: async function () {
        return JSON.stringify(await this.json())
      },
      json: async () => ({}),
    }
  }) as unknown as typeof globalThis.fetch
  return globalThis.fetch
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('checkbox is off when the flag is off', async () => {
  mockSettings({ getPilot: false })
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText('NES Nostalgist pilot')
  expect(box).not.toBeChecked()
  expect(screen.getByText(/WebRetro ships with the image/i)).toBeInTheDocument()
})

test('toggling on PUTs nostalgist_nes_pilot true', async () => {
  mockSettings({ getPilot: false })
  const user = userEvent.setup()
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText('NES Nostalgist pilot')
  await user.click(box)
  await waitFor(() => {
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/browser-player-settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ nostalgist_nes_pilot: true }),
      }),
    )
  })
  expect(showToast).toHaveBeenCalled()
})

test('EmulatorJS is disabled with the reason until the release is on disk', async () => {
  mockSettings({ available: ['webretro'] })
  render(<BrowserPlayerPilot />)
  const ejs = await screen.findByLabelText(/EmulatorJS/)
  expect(ejs).toBeDisabled()
  expect(screen.getByText(/not installed on this server/i)).toBeInTheDocument()
  expect(screen.getAllByText(/fetch-emulatorjs\.sh/).length).toBeGreaterThan(0)
  expect(screen.getByLabelText(/^WebRetro$/)).toBeChecked()
})

test('choosing EmulatorJS PUTs browser_player_default when it is installed', async () => {
  const fetchSpy = mockSettings({ available: ['webretro', 'emulatorjs'] })
  render(<BrowserPlayerPilot />)
  const ejs = await screen.findByLabelText(/EmulatorJS/)
  expect(ejs).not.toBeDisabled()
  expect(screen.queryByText(/not installed on this server/i)).not.toBeInTheDocument()
  await userEvent.click(ejs)
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/browser-player-settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ browser_player_default: 'emulatorjs' }),
      }),
    )
  })
  expect(ejs).toBeChecked()
})

test('member choice PUTs browser_player_allow_member_choice and says when it bites', async () => {
  const fetchSpy = mockSettings({ available: ['webretro'] })
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText(/Let members choose their engine/)
  expect(box).not.toBeChecked()
  // One engine installed: the flag is stored but cannot do anything yet.
  expect(screen.getByText(/takes effect once a second engine is installed/i)).toBeInTheDocument()
  await userEvent.click(box)
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/browser-player-settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ browser_player_allow_member_choice: true }),
      }),
    )
  })
  expect(box).toBeChecked()
})

test('member choice reflects the stored flag with both engines installed', async () => {
  mockSettings({ available: ['webretro', 'emulatorjs'], memberChoice: true })
  render(<BrowserPlayerPilot />)
  const box = await screen.findByLabelText(/Let members choose their engine/)
  expect(box).toBeChecked()
  expect(
    screen.queryByText(/takes effect once a second engine is installed/i),
  ).not.toBeInTheDocument()
})
