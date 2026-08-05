import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SpaceRail } from './SpaceRail'

const SPACES = {
  ok: true,
  spaces: [
    {
      id: 1,
      name: 'Household',
      visibility: 'household',
      channels: [{ id: 10, name: 'general', kind: 'channel' }],
      voice_channels: [{ id: 11, name: 'Lounge', kind: 'voice', room: 'voice:11' }],
    },
    {
      id: 2,
      name: 'Raid Night',
      visibility: 'invite',
      channels: [],
      voice_channels: [],
    },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => SPACES })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists spaces with their text and voice channels', async () => {
  render(<SpaceRail />)
  expect(await screen.findByText('Household')).toBeInTheDocument()
  expect(screen.getByText('Raid Night')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Lounge/i })).toBeInTheDocument()
})

test('marks invite-only spaces so membership is visible at a glance', async () => {
  render(<SpaceRail />)
  await screen.findByText('Raid Night')
  expect(screen.getByTitle('Invite only')).toBeInTheDocument()
})

test('voice selection hands back the server-issued room, never a typed one', async () => {
  const onSelectVoiceChannel = vi.fn()
  const user = (await import('@testing-library/user-event')).default.setup()
  render(<SpaceRail onSelectVoiceChannel={onSelectVoiceChannel} />)

  await user.click(await screen.findByRole('button', { name: /Lounge/i }))

  expect(onSelectVoiceChannel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 11, room: 'voice:11' }),
    expect.objectContaining({ id: 1 }),
  )
})

test('text selection reports the channel to the parent', async () => {
  const onSelectTextChannel = vi.fn()
  const user = (await import('@testing-library/user-event')).default.setup()
  render(<SpaceRail onSelectTextChannel={onSelectTextChannel} />)

  await user.click(await screen.findByRole('button', { name: /general/i }))

  expect(onSelectTextChannel).toHaveBeenCalledWith(
    expect.objectContaining({ id: 10 }),
    expect.objectContaining({ id: 1 }),
  )
})

test('honest empty state when the member is in no spaces', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, spaces: [] }) })),
  )
  render(<SpaceRail />)
  expect(await screen.findByText(/No spaces yet/i)).toBeInTheDocument()
})

test('surfaces the server error rather than rendering an empty rail', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Nope' }) })),
  )
  render(<SpaceRail />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
})

test('invite redemption posts the token and refreshes', async () => {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opts) => {
      calls.push({ url, opts })
      if (String(url).endsWith('/join')) {
        return { ok: true, json: async () => ({ ok: true, space: { id: 3, name: 'Joined' } }) }
      }
      return { ok: true, json: async () => SPACES }
    }),
  )
  const user = (await import('@testing-library/user-event')).default.setup()
  render(<SpaceRail />)

  await screen.findByText('Household')
  await user.type(screen.getByLabelText(/Join with invite/i), 'tok-123')
  await user.click(screen.getByRole('button', { name: /^Join$/i }))

  await waitFor(() => {
    const join = calls.find((c) => String(c.url).endsWith('/join'))
    expect(join).toBeTruthy()
    expect(JSON.parse(join.opts.body)).toEqual({ token: 'tok-123' })
  })
})
