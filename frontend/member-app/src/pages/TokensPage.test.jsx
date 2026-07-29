import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { TokensPage } from './TokensPage'
import * as tokensApi from '../api/tokens'

vi.mock('../api/tokens', () => ({
  listTokens: vi.fn(),
  createToken: vi.fn(),
  revokeToken: vi.fn(),
}))

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

test('lists tokens and creates with companion preset', async () => {
  const user = userEvent.setup()
  tokensApi.createToken.mockResolvedValue({
    token: {
      id: 8,
      name: 'My PC',
      token_prefix: 'gt_efgh',
      scopes: ['read:library', 'write:download'],
      created_at: '2026-07-28T12:00:00+00:00',
      last_used_at: null,
      revoked: false,
    },
    secret: 'gt_efgh_one_time_secret',
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
          token_prefix: 'gt_efgh',
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

  await waitFor(() => {
    expect(tokensApi.createToken).toHaveBeenCalledWith({
      name: 'My PC',
      preset: 'companion',
    })
  })

  expect(await screen.findByText('gt_efgh_one_time_secret')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(/store this secret now/i)
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
