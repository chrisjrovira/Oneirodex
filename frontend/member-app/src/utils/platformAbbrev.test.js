import { abbreviatePlatform, platformChipLabels, PLATFORM_ABBREV } from './platformAbbrev'

test('locked GM abbrevs match map', () => {
  expect(abbreviatePlatform('NGC')).toBe('GC')
  expect(abbreviatePlatform('SWITCH')).toBe('NSW')
  expect(abbreviatePlatform('SEGA_MD')).toBe('MD')
  expect(abbreviatePlatform('PSX')).toBe('PS1')
  expect(abbreviatePlatform('XBOX')).toBe('XB')
  expect(abbreviatePlatform('PCWIN')).toBe('PC')
  expect(abbreviatePlatform('ARCADE')).toBe('ARC')
  expect(abbreviatePlatform('NEOGEO')).toBe('AES')
  expect(abbreviatePlatform('VICE_X64SC')).toBe('C64')
  expect(PLATFORM_ABBREV.SEGA_MD).toBe('MD')
})

test('platformChipLabels keeps full name for tooltip', () => {
  expect(
    platformChipLabels({
      library_platform: 'PCWIN',
      library_platform_label: 'PC Windows',
    }),
  ).toEqual({ abbrev: 'PC', full: 'PC Windows' })
})
