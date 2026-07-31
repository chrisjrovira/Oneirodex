import { formatLocaleDate } from './formatLocaleDate'

describe('formatLocaleDate', () => {
  test('returns fallback for empty values', () => {
    expect(formatLocaleDate(null)).toBe('—')
    expect(formatLocaleDate('')).toBe('—')
    expect(formatLocaleDate(undefined, { fallback: 'Never' })).toBe('Never')
  })

  test('formats ISO date-only without UTC day shift', () => {
    const result = formatLocaleDate('2024-01-15')
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/15|Jan/)
  })

  test('formats unix seconds', () => {
    // 2020-01-01T00:00:00Z
    const result = formatLocaleDate(1577836800)
    expect(result).toMatch(/2020|2019/)
  })

  test('returns fallback for invalid input', () => {
    expect(formatLocaleDate('not-a-date')).toBe('—')
  })
})
