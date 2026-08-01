import { expect, test } from 'vitest'
import { extractOneTimeSecret } from './tokens'

test('extractOneTimeSecret prefers raw then secret then string token', () => {
  expect(
    extractOneTimeSecret({
      raw: 'gt_aaaa_raw-secret_value',
      secret: 'gt_bbbb_other',
    }),
  ).toBe('gt_aaaa_raw-secret_value')

  expect(extractOneTimeSecret({ secret: 'gt_cccc_only-secret' })).toBe('gt_cccc_only-secret')
  expect(extractOneTimeSecret({ token: 'gt_dddd_string-token' })).toBe('gt_dddd_string-token')
})

test('extractOneTimeSecret trims outer whitespace only and keeps hyphens', () => {
  const secret = 'gt_ef01_part-one_part-two'
  expect(extractOneTimeSecret({ secret: `  ${secret}\n` })).toBe(secret)
  expect(extractOneTimeSecret({ secret })).toContain('-two')
  expect(extractOneTimeSecret({ secret }).split('-').pop()).toBe('two')
})

test('extractOneTimeSecret ignores object token and non-gt strings', () => {
  expect(
    extractOneTimeSecret({
      token: { id: 1, token_prefix: 'abcd' },
      secret: 'not-a-token',
    }),
  ).toBe('')
  expect(extractOneTimeSecret(null)).toBe('')
  expect(extractOneTimeSecret({})).toBe('')
})
