import { describe, expect, it } from 'vitest'
import { formatBearerAuthorization } from './client.js'

describe('formatBearerAuthorization', () => {
  it('prefixes gt_ token with Bearer', () => {
    expect(formatBearerAuthorization('gt_ab12_secret')).toBe('Bearer gt_ab12_secret')
  })

  it('normalizes existing Bearer prefix', () => {
    expect(formatBearerAuthorization('bearer gt_ab12_secret')).toBe('Bearer gt_ab12_secret')
  })
})
