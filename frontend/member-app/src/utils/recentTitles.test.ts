import { afterEach, expect, test } from 'vitest'
import {
  RECENT_TITLES_KEY,
  mergeSuggestRecent,
  normalizeRecentTitle,
  readRecentTitles,
  recordRecentTitle,
} from './recentTitles'

afterEach(() => {
  window.localStorage.removeItem(RECENT_TITLES_KEY)
})

test('normalizeRecentTitle drops empty rows', () => {
  expect(normalizeRecentTitle({ uuid: '', name: 'X' })).toBeNull()
  expect(normalizeRecentTitle({ uuid: 'a', name: '  ' })).toBeNull()
  expect(normalizeRecentTitle({ uuid: 'a', name: 'Hades' })).toEqual({
    uuid: 'a',
    name: 'Hades',
    hint: 'Opened here',
  })
})

test('recordRecentTitle newest-first and unique', () => {
  recordRecentTitle({ uuid: 'a', name: 'Alpha' })
  recordRecentTitle({ uuid: 'b', name: 'Beta' })
  recordRecentTitle({ uuid: 'a', name: 'Alpha' })
  expect(readRecentTitles().map((row) => row.uuid)).toEqual(['a', 'b'])
})

test('mergeSuggestRecent prefers server played rows then local opened', () => {
  const merged = mergeSuggestRecent(
    [{ uuid: 'p', name: 'Played', hint: 'Played recently' }],
    [
      { uuid: 'p', name: 'Played again' },
      { uuid: 'o', name: 'Opened' },
    ],
  )
  expect(merged.map((row) => row.uuid)).toEqual(['p', 'o'])
  expect(merged[0].hint).toBe('Played recently')
  expect(merged[1].hint).toBe('Opened here')
})
