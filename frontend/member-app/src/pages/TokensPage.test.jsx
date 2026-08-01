import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { TokensPage } from './TokensPage'
import * as tokensApi from '../api/tokens'
import { showToast } from '../utils/toast'

vi.mock('../api/tokens', () => ({
  listTokens: vi.fn(),
  createToken: vi.fn(),
  revokeToken: vi.fn(),
}))

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

function stubExecCommand(returnValue) {
  const fn = vi.fn().mockReturnValue(returnValue)
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: fn,
  })
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
  tokensApi.listTokens.mockResolvedValue({
    tokens: [
      {
        id: 7,
        name: 'Living room PC',
        token_prefix: 'gt_abcd',
        scopes: ['read:library', 'write:download'],
        created_at: '2026-07-01T12:00:00+00:00',
        last_used_at: null,
        revoked: false,
      },
    ],
    scope_presets: {
      companion: {
        label: 'Desktop companion',
        scopes: ['read:library', 'write:download'],
      },
      thin: {
        label: 'Thin client',
        scopes: ['read:library', 'read:social', 'write:presence'],
      },
    },
    valid_scopes: ['read:library', 'write:download'],
  })
})

async function createAndRevealSecret(user, secret = 'gt_efgh_one-time_secret_value') {
  tokensApi.createToken.mockResolvedValue({
    token: {
      id: 8,
      name: 'My PC',
      token_prefix: 'efgh',
      scopes: ['read:library', 'write:download'],
      created_at: '2026-07-28T12:00:00+00:00',
      last_used_at: null,
      revoked: false,
    },
    secret,
    warning: 'Store this secret now; it will not be shown again.',
  })
  tokensApi.listTokens
    .mockResolvedValueOnce({
      tokens: [
        {
          id: 7,
          name: 'Living room PC',
          token_prefix: 'gt_abcd',
          scopes: ['read:library', 'write:download'],
          created_at: '2026-07-01T12:00:00+00:00',
          last_used_at: null,
          revoked: false,
        },
      ],
      scope_presets: {
        companion: { label: 'Desktop companion', scopes: ['read:library', 'write:download'] },
        thin: { label: 'Thin client', scopes: ['read:library', 'read:social', 'write:presence'] },
      },
    })
    .mockResolvedValue({
      tokens: [
        {
          id: 7,
          name: 'Living room PC',
          token_prefix: 'gt_abcd',
          scopes: ['read:library', 'write:download'],
          created_at: '2026-07-01T12:00:00+00:00',
          last_used_at: null,
          revoked: false,
        },
        {
          id: 8,
          name: 'My PC',
          token_prefix: 'efgh',
          scopes: ['read:library', 'write:download'],
          created_at: '2026-07-28T12:00:00+00:00',
          last_used_at: null,
          revoked: false,
        },
      ],
      scope_presets: {
        companion: { label: 'Desktop companion', scopes: ['read:library', 'write:download'] },
        thin: { label: 'Thin client', scopes: ['read:library', 'read:social', 'write:presence'] },
      },
    })

  render(<TokensPage />)
  expect(await screen.findByText('Living room PC')).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Name$/i), 'My PC')
  await user.click(screen.getByRole('button', { name: /create token/i }))
  const field = await screen.findByLabelText(/one-time secret/i)
  expect(field).toHaveValue(secret)
  return { secret, field }
}

test('lists tokens and creates with companion preset', async () => {
  const user = userEvent.setup()
  await createAndRevealSecret(user, 'gt_efgh_one_time_secret')

  await waitFor(() => {
    expect(tokensApi.createToken).toHaveBeenCalledWith({
      name: 'My PC',
      preset: 'companion',
    })
  })

  expect(screen.getByRole('status')).toHaveTextContent(/store this secret now/i)
})

test('copy secret writes pure token string with no labels or junk', async () => {
  const user = userEvent.setup()
  const secret = 'gt_efgh_abc-def_ghi-jkl'
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

  const { field } = await createAndRevealSecret(user, secret)

  expect(field).toHaveValue(secret)
  expect(field.value).not.toMatch(/prefix|Store this|My PC|…/)
  expect(field.value.endsWith('-jkl')).toBe(true)

  await user.click(screen.getByRole('button', { name: /copy secret/i }))

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(secret)
  })
  expect(writeText.mock.calls[0][0]).toBe(secret)
  expect(writeText.mock.calls[0][0]).not.toContain('…')
  expect(writeText.mock.calls[0][0]).not.toContain('prefix')
  expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  expect(showToast).toHaveBeenCalledWith('Token secret copied', 'success')
})

test('display keeps full urlsafe secret after final hyphen', async () => {
  const user = userEvent.setup()
  const secret = 'gt_9f2a_xY7-zQ9_rest'
  await createAndRevealSecret(user, secret)

  const field = screen.getByLabelText(/one-time secret/i)
  expect(field).toHaveValue(secret)
  expect(field.value).toContain('-zQ9_rest')
  expect(screen.getByText(/hyphens and underscores/i)).toBeInTheDocument()
})

test('copy secret falls back when clipboard API rejects', async () => {
  const user = userEvent.setup()
  const secret = 'gt_efgh_fallback-secret_value'
  const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const exec = stubExecCommand(true)

  await createAndRevealSecret(user, secret)
  await user.click(screen.getByRole('button', { name: /copy secret/i }))

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(secret)
  })
  expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  expect(exec).toHaveBeenCalledWith('copy')
})

test('copy secret shows manual-select guidance when all copy paths fail', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  stubExecCommand(false)

  const { field } = await createAndRevealSecret(user, 'gt_efgh_manual-only_secret')
  await user.click(screen.getByRole('button', { name: /copy secret/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/clipboard unavailable/i)
  expect(showToast).toHaveBeenCalledWith(
    expect.stringMatching(/clipboard unavailable/i),
    'warn',
  )
  expect(field).toHaveFocus()
  expect(field.selectionStart).toBe(0)
  expect(field.selectionEnd).toBe(field.value.length)
})

test('revokes a token after confirm', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  tokensApi.revokeToken.mockResolvedValue({ ok: true })
  tokensApi.listTokens
    .mockResolvedValueOnce({
      tokens: [
        {
          id: 7,
          name: 'Living room PC',
          token_prefix: 'gt_abcd',
          scopes: ['read:library', 'write:download'],
          created_at: '2026-07-01T12:00:00+00:00',
          last_used_at: null,
          revoked: false,
        },
      ],
      scope_presets: {},
    })
    .mockResolvedValue({
      tokens: [],
      scope_presets: {},
    })

  render(<TokensPage />)
  expect(await screen.findByText('Living room PC')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /revoke/i }))

  await waitFor(() => {
    expect(tokensApi.revokeToken).toHaveBeenCalledWith(7)
  })
  expect(await screen.findByText(/no active tokens yet/i)).toBeInTheDocument()
})
