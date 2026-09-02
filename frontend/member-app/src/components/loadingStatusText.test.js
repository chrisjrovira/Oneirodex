import { describe, expect, test } from 'vitest'
import { loadingEllipsisFrame, loadingMessageBase } from './loadingStatusText'

describe('loadingMessageBase', () => {
  test('strips unicode and ascii ellipsis', () => {
    expect(loadingMessageBase('Loading activity…')).toBe('Loading activity')
    expect(loadingMessageBase('Loading Discover...')).toBe('Loading Discover')
    expect(loadingMessageBase('Loading')).toBe('Loading')
  })
})

describe('loadingEllipsisFrame', () => {
  test('cycles with a leading space', () => {
    expect(loadingEllipsisFrame(0)).toBe(' .')
    expect(loadingEllipsisFrame(1)).toBe(' ..')
    expect(loadingEllipsisFrame(2)).toBe(' ...')
    expect(loadingEllipsisFrame(3)).toBe(' .')
  })
})
