import { clampTileVarsForNarrowViewport, normalizeTilePercent, tilePercentToCssVars, tileSizeToCssVars } from './tileSize'

test('normalizeTilePercent maps legacy letters and clamps', () => {
  expect(normalizeTilePercent('S')).toBe(25)
  expect(normalizeTilePercent('M')).toBe(50)
  expect(normalizeTilePercent('L')).toBe(75)
  expect(normalizeTilePercent('XL')).toBe(100)
  expect(normalizeTilePercent('80')).toBe(80)
  expect(normalizeTilePercent(120)).toBe(100)
  expect(normalizeTilePercent(-5)).toBe(0)
  expect(normalizeTilePercent(undefined)).toBe(50)
})

test('tilePercentToCssVars scales min width', () => {
  expect(tilePercentToCssVars(0)['--gt-tile-min']).toBe('120px')
  expect(tilePercentToCssVars(100)['--gt-tile-min']).toBe('300px')
  expect(tilePercentToCssVars(50)['--gt-tile-min']).toBe('210px')
})

test('normalizeTilePercent preserves fractional percent for smooth dragging', () => {
  expect(normalizeTilePercent(63.7)).toBeCloseTo(63.7)
  expect(normalizeTilePercent('12.5')).toBeCloseTo(12.5)
  expect(normalizeTilePercent(99.996)).toBeCloseTo(100)
})

test('tilePercentToCssVars produces continuous (non-integer-snapped) pixel widths', () => {
  const a = tilePercentToCssVars(33.3)
  const b = tilePercentToCssVars(33.8)
  expect(a['--gt-tile-min']).not.toBe(b['--gt-tile-min'])
  expect(a['--gt-tile-min']).toBe('179.94px')
})

test('tileSizeToCssVars still accepts legacy letters', () => {
  expect(tileSizeToCssVars('S')).toEqual(tilePercentToCssVars(25))
  expect(tileSizeToCssVars('M')).toEqual(tilePercentToCssVars(50))
})

test('clampTileVarsForNarrowViewport caps large tiles', () => {
  expect(clampTileVarsForNarrowViewport(tilePercentToCssVars(100), true)).toEqual({
    '--gt-tile-min': '140px',
    '--gt-tile-gap': '6px',
  })
  expect(clampTileVarsForNarrowViewport(tilePercentToCssVars(0), true)).toEqual(tilePercentToCssVars(0))
  expect(clampTileVarsForNarrowViewport(tilePercentToCssVars(100), false)).toEqual(tilePercentToCssVars(100))
})
