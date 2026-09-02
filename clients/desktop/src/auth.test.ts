import { describe, expect, it } from 'vitest'
import {
  createAuthStore,
  describeTokenPaste,
  isOneirodexToken,
  normalizeOneirodexToken,
} from './auth.js'

describe('auth authorization header', () => {
  it('formats Bearer gt_ token for API requests', () => {
    const auth = createAuthStore({
      baseUrl: 'https://oneirodex.local',
      token: 'gt_ab12cd34_secretpart',
    })

    expect(auth.authorizationHeader()).toBe('Bearer gt_ab12cd34_secretpart')
  })

  it('returns null when no token is configured', () => {
    const auth = createAuthStore({ baseUrl: 'https://oneirodex.local', token: null })
    expect(auth.authorizationHeader()).toBeNull()
  })
})

describe('normalizeOneirodexToken', () => {
  it('strips whitespace, BOM, zero-width, and wrapping quotes', () => {
    expect(normalizeOneirodexToken('  gt_ab12cd34_secret  ')).toBe('gt_ab12cd34_secret')
    expect(normalizeOneirodexToken('\ufeffgt_ab12cd34_secret')).toBe('gt_ab12cd34_secret')
    expect(normalizeOneirodexToken('gt_ab12cd34_\u200bsecret')).toBe('gt_ab12cd34_secret')
    expect(normalizeOneirodexToken('"gt_ab12cd34_secret"')).toBe('gt_ab12cd34_secret')
    expect(normalizeOneirodexToken("'gt_ab12cd34_secret'")).toBe('gt_ab12cd34_secret')
  })

  it('strips trailing newlines and keeps urlsafe hyphens in the secret', () => {
    const token = 'gt_a1b2c3d4_AbCd-EfGh_IjKl-'
    expect(normalizeOneirodexToken(`${token}\n`)).toBe(token)
    expect(normalizeOneirodexToken(`${token}\r\n`)).toBe(token)
    expect(normalizeOneirodexToken(`  ${token}  \n`)).toBe(token)
  })

  it('extracts the first gt_ token from labeled / HTML / junk pastes', () => {
    const token = 'gt_deadbeef_xY9-_zQ_wR8tU7vS6pO5nM4lK3jI2hG-'
    expect(normalizeOneirodexToken(`API token: ${token}`)).toBe(token)
    expect(normalizeOneirodexToken(`${token}…`)).toBe(token)
    expect(normalizeOneirodexToken(`${token}...`)).toBe(token)
    expect(normalizeOneirodexToken(`${token} Copy`)).toBe(token)
    expect(normalizeOneirodexToken(`<code>${token}</code>`)).toBe(token)
    expect(normalizeOneirodexToken(`Secret\n${token}\njunk`)).toBe(token)
  })

  it('does not truncate a corrupted secret at an embedded bad character', () => {
    // Regex would match only through "bad" before "!"; that must not become a false token.
    expect(normalizeOneirodexToken('gt_ab12cd34_bad!chars')).toBe('gt_ab12cd34_bad!chars')
    expect(isOneirodexToken('gt_ab12cd34_bad!chars')).toBe(false)
  })

  it('must not truncate the secret at the last hyphen', () => {
    const token = 'gt_00ff11aa_secret-with-hyphen-end-'
    expect(normalizeOneirodexToken(token)).toBe(token)
    expect(normalizeOneirodexToken(`${token} trailing junk!`)).toBe(token)
    // Explicit anti-regression: lastIndexOf('-') truncate would drop the final '-'
    expect(normalizeOneirodexToken(token).endsWith('-')).toBe(true)
    expect(normalizeOneirodexToken(token)).not.toBe('gt_00ff11aa_secret-with-hyphen-end')
  })
})

describe('isOneirodexToken', () => {
  it('accepts gt_prefix_secret shape', () => {
    expect(isOneirodexToken('gt_ab12cd34_secretpart')).toBe(true)
  })

  it('accepts realistic token_urlsafe secrets with - and _', () => {
    // secrets.token_urlsafe(32) samples — base64url may include - and _
    expect(isOneirodexToken('gt_a1b2c3d4_AbCdEfGhIjKlMnOpQrStUvWxYz0123-_')).toBe(true)
    expect(isOneirodexToken('gt_deadbeef_xY9-_zQ_wR8tU7vS6pO5nM4lK3jI2hG')).toBe(true)
    expect(isOneirodexToken('gt_00ff11aa_----____AAAA')).toBe(true)
    expect(isOneirodexToken('gt_00ff11aa_ends-with-hyphen-')).toBe(true)
  })

  it('accepts pasted tokens with clipboard noise', () => {
    expect(isOneirodexToken('  "gt_ab12cd34_sec-ret_part"  ')).toBe(true)
    expect(isOneirodexToken('\ufeffgt_ab12cd34_url-safe_secret')).toBe(true)
    expect(isOneirodexToken('gt_ab12cd34_url-safe_secret-\n')).toBe(true)
    expect(isOneirodexToken('Token: gt_ab12cd34_sec-ret_part- Copy')).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(isOneirodexToken('not-a-token')).toBe(false)
    expect(isOneirodexToken('gt_onlyprefix')).toBe(false)
    expect(isOneirodexToken('gt__nosePrefix')).toBe(false)
    expect(isOneirodexToken('gt_ab12cd34_')).toBe(false)
    expect(isOneirodexToken('gt_ab12cd34_bad!chars')).toBe(false)
    expect(isOneirodexToken('')).toBe(false)
  })

  it('describeTokenPaste never includes the secret body', () => {
    const raw = 'gt_ab12cd34_super-secret-value-'
    const desc = describeTokenPaste(raw)
    expect(desc).toContain('prefix=ab12cd34')
    expect(desc).toContain('shapeOk=true')
    expect(desc).toContain('endsWithHyphen=true')
    expect(desc).not.toContain('super-secret')
  })
})
