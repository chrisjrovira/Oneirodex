import { describe, expect, test } from 'vitest'
import {
  SHELF_FULLY_VISIBLE_RATIO,
  isShelfItemFullyVisible,
} from './shelfItemVisibility'

describe('isShelfItemFullyVisible', () => {
  test('accepts a fully intersecting tile', () => {
    expect(isShelfItemFullyVisible(1)).toBe(true)
    expect(isShelfItemFullyVisible(SHELF_FULLY_VISIBLE_RATIO)).toBe(true)
  })

  test('rejects a clipped edge tile', () => {
    expect(isShelfItemFullyVisible(0.5)).toBe(false)
    expect(isShelfItemFullyVisible(0.98)).toBe(false)
    expect(isShelfItemFullyVisible(0)).toBe(false)
  })
})
