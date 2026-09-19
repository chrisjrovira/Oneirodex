import { expect, test } from 'vitest'
import { gameCountHeat } from './gameCountHeat'

test('stays neutral when the platform total is unknown', () => {
  expect(gameCountHeat(1640, null)).toBeNull()
  expect(gameCountHeat(0, 0)).toBeNull()
  expect(gameCountHeat(10, undefined)).toBeNull()
})

test('is red at empty and green at a full set', () => {
  const empty = gameCountHeat(0, 100)
  const full = gameCountHeat(100, 100)
  const over = gameCountHeat(120, 100)
  expect(empty.hue).toBe(0)
  expect(full.hue).toBe(120)
  expect(over.hue).toBe(120)
  expect(empty.color).toMatch(/hsl\(0 /)
  expect(full.color).toMatch(/hsl\(120 /)
})

test('names the owned/released pair', () => {
  expect(gameCountHeat(32, 200).title).toBe('32 of 200 released')
})
