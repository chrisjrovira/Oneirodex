import {
  clampTileVarsForNarrowViewport,
  normalizeTilePercent,
  TILE_HOVER_SCALE,
  tilePercentToCssVars,
  tileSizeToCssVars,
} from './tileSize'

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
    '--gt-tile-hover-scale': String(TILE_HOVER_SCALE),
  })

  // Small tiles keep their size on a narrow viewport — they are already small
  // enough — and the hover lift is no longer touched either, now that it is a
  // flat 15% rather than the old 1.6x-at-small-tiles curve.
  expect(clampTileVarsForNarrowViewport(tilePercentToCssVars(0), true)).toEqual(
    tilePercentToCssVars(0),
  )

  expect(clampTileVarsForNarrowViewport(tilePercentToCssVars(100), false)).toEqual(tilePercentToCssVars(100))
})

test('hover scale is one flat value at every tile size', () => {
  // It used to run against tile size (1.6 small -> 1.06 large). That curve
  // never reached the screen — a later `.game-card:hover` rule hardcoded
  // scale(1.08) and won on source order — and a lift that changes with a
  // slider the member set once reads as a bug rather than a feature.
  const small = Number(tilePercentToCssVars(0)['--gt-tile-hover-scale'])
  const mid = Number(tilePercentToCssVars(50)['--gt-tile-hover-scale'])
  const large = Number(tilePercentToCssVars(100)['--gt-tile-hover-scale'])

  expect(small).toBe(TILE_HOVER_SCALE)
  expect(mid).toBe(TILE_HOVER_SCALE)
  expect(large).toBe(TILE_HOVER_SCALE)
  expect(TILE_HOVER_SCALE).toBeCloseTo(1.15)
})

test('narrow viewports keep the same lift', () => {
  const vars = tilePercentToCssVars(0)
  const clamped = clampTileVarsForNarrowViewport(vars, true)

  // 15% of a 140px tile is ~10px either side — it stays inside its own track,
  // so there is nothing left for the narrow-viewport clamp to protect against.
  expect(clamped['--gt-tile-hover-scale']).toBe(String(TILE_HOVER_SCALE))
})
