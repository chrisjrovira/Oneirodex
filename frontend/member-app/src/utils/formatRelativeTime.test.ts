import { expect, test } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

const NOW = Date.parse('2026-09-17T12:00:00Z')

test('coarse buckets, oldest falls back to a date', () => {
  expect(formatRelativeTime('2026-09-17T11:59:40Z', NOW)).toBe('just now')
  expect(formatRelativeTime('2026-09-17T11:55:00Z', NOW)).toBe('5 min ago')
  expect(formatRelativeTime('2026-09-17T09:00:00Z', NOW)).toBe('3 hours ago')
  expect(formatRelativeTime('2026-09-17T11:00:00Z', NOW)).toBe('1 hour ago')
  expect(formatRelativeTime('2026-09-15T12:00:00Z', NOW)).toBe('2 days ago')
  expect(formatRelativeTime('2026-09-16T12:00:00Z', NOW)).toBe('1 day ago')
  expect(formatRelativeTime('2026-08-01T12:00:00Z', NOW)).toBe(
    new Date('2026-08-01T12:00:00Z').toLocaleDateString(),
  )
})

test('empty for missing or junk', () => {
  expect(formatRelativeTime(null, NOW)).toBe('')
  expect(formatRelativeTime('', NOW)).toBe('')
  expect(formatRelativeTime('not a date', NOW)).toBe('')
})
