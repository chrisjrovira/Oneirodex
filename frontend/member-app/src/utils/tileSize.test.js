import { tileSizeToCssVars } from './tileSize'

test('maps sizes', () => {
  expect(tileSizeToCssVars('S')['--gt-tile-min']).toBe('140px')
  expect(tileSizeToCssVars('M')['--gt-tile-min']).toBe('180px')
  expect(tileSizeToCssVars('L')['--gt-tile-min']).toBe('220px')
  expect(tileSizeToCssVars('XL')['--gt-tile-min']).toBe('280px')
})

test('falls back to M for unknown sizes', () => {
  expect(tileSizeToCssVars('unknown')['--gt-tile-min']).toBe('180px')
  expect(tileSizeToCssVars(undefined)['--gt-tile-min']).toBe('180px')
})