import { tileSizeToCssVars } from './tileSize'

test('maps sizes', () => {
  expect(tileSizeToCssVars('S')).toEqual({ '--gt-tile-min': '140px', '--gt-tile-gap': '6px' })
  expect(tileSizeToCssVars('M')).toEqual({ '--gt-tile-min': '180px', '--gt-tile-gap': '10px' })
  expect(tileSizeToCssVars('L')).toEqual({ '--gt-tile-min': '220px', '--gt-tile-gap': '12px' })
  expect(tileSizeToCssVars('XL')).toEqual({ '--gt-tile-min': '280px', '--gt-tile-gap': '14px' })
})

test('falls back to M for unknown sizes', () => {
  expect(tileSizeToCssVars('unknown')).toEqual({
    '--gt-tile-min': '180px',
    '--gt-tile-gap': '10px',
  })
  expect(tileSizeToCssVars(undefined)).toEqual({
    '--gt-tile-min': '180px',
    '--gt-tile-gap': '10px',
  })
})