import { describe, expect, it } from 'vitest'
import { createAuthStore, isGamethecaToken } from './auth.js'

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

describe('isGamethecaToken', () => {
  it('accepts gt_prefix_secret shape', () => {
    expect(isGamethecaToken('gt_ab12cd34_secretpart')).toBe(true)
  })

  it('rejects malformed tokens', () => {
    expect(isGamethecaToken('not-a-token')).toBe(false)
  })
})
