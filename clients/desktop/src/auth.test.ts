import { describe, expect, it } from 'vitest'
import {
  createAuthStore,
  isGamethecaToken,
  normalizeGamethecaToken,
} from './auth.js'

describe('auth authorization header', () => {
  it('formats Bearer gt_ token for API requests', () => {
    const auth = createAuthStore({
      baseUrl: 'https://gametheca.local',
      token: 'gt_ab12cd34_secretpart',
    })

    expect(auth.authorizationHeader()).toBe('Bearer gt_ab12cd34_secretpart')
  })

  it('returns null when no token is configured', () => {
    const auth = createAuthStore({ baseUrl: 'https://gametheca.local', token: null })
    expect(auth.authorizationHeader()).toBeNull()
  })
})

describe('normalizeGamethecaToken', () => {
  it('strips whitespace, BOM, zero-width, and wrapping quotes', () => {
    expect(normalizeGamethecaToken('  gt_ab12cd34_secret  ')).toBe('gt_ab12cd34_secret')
    expect(normalizeGamethecaToken('\ufeffgt_ab12cd34_secret')).toBe('gt_ab12cd34_secret')
    expect(normalizeGamethecaToken('gt_ab12cd34_\u200bsecret')).toBe('gt_ab12cd34_secret')
    expect(normalizeGamethecaToken('"gt_ab12cd34_secret"')).toBe('gt_ab12cd34_secret')
    expect(normalizeGamethecaToken("'gt_ab12cd34_secret'")).toBe('gt_ab12cd34_secret')
  })
})

describe('isGamethecaToken', () => {
  it('accepts gt_prefix_secret shape', () => {
    expect(isGamethecaToken('gt_ab12cd34_secretpart')).toBe(true)
  })

  it('accepts realistic token_urlsafe secrets with - and _', () => {
    // secrets.token_urlsafe(32) samples — base64url may include - and _
    expect(isGamethecaToken('gt_a1b2c3d4_AbCdEfGhIjKlMnOpQrStUvWxYz0123-_')).toBe(true)
    expect(isGamethecaToken('gt_deadbeef_xY9-_zQ_wR8tU7vS6pO5nM4lK3jI2hG')).toBe(true)
    expect(isGamethecaToken('gt_00ff11aa_----____AAAA')).toBe(true)
  })

  it('accepts pasted tokens with clipboard noise', () => {
    expect(isGamethecaToken('  "gt_ab12cd34_sec-ret_part"  ')).toBe(true)
    expect(isGamethecaToken('\ufeffgt_ab12cd34_url-safe_secret')).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(isGamethecaToken('not-a-token')).toBe(false)
    expect(isGamethecaToken('gt_onlyprefix')).toBe(false)
    expect(isGamethecaToken('gt__nosePrefix')).toBe(false)
    expect(isGamethecaToken('gt_ab12cd34_')).toBe(false)
    expect(isGamethecaToken('gt_ab12cd34_bad!chars')).toBe(false)
    expect(isGamethecaToken('')).toBe(false)
  })
})
