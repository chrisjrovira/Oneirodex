import { describe, expect, it, test } from 'vitest'
import {
  abbreviatePlatform,
  editionChipLabels,
  platformChipLabels,
  PLATFORM_ABBREV,
} from './platformAbbrev'

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

describe('editionChipLabels', () => {
  // Browse collapses copies of one title into one row and sends
  // `edition_platforms` newest hardware first. `+N` counts the *other* systems,
  // the same meaning it has for badge overflow and the preview's system count.
  const grouped = {
    library_platform: 'SNES',
    library_platform_label: 'Super Nintendo Entertainment System (SNES)',
    edition_platforms: ['GBA', 'SNES', 'NES'],
  }

  it('names the newest system when nothing is filtered', () => {
    const chip = editionChipLabels(grouped, '')
    expect(chip.abbrev).toBe(abbreviatePlatform('GBA'))
    expect(chip.extra).toBe(2)
  })

  it('names the system you are filtered to, not the newest one', () => {
    // You are looking at the NES copy; calling it GBA would be a lie about
    // which tile this is.
    const chip = editionChipLabels(grouped, 'NES')
    expect(chip.abbrev).toBe(abbreviatePlatform('NES'))
    expect(chip.extra).toBe(2)
  })

  it('ignores a filter for a system the title is not on', () => {
    const chip = editionChipLabels(grouped, 'PS5')
    expect(chip.abbrev).toBe(abbreviatePlatform('GBA'))
  })

  it('shows no +N for a title on one system', () => {
    const chip = editionChipLabels(
      { library_platform: 'NES', edition_platforms: ['NES'] },
      '',
    )
    expect(chip.extra).toBe(0)
  })

  it('falls back to the tile own system when browse sends no grouping', () => {
    // Favorites and Discover render the same card without the grouped payload;
    // the chip must not vanish there.
    const chip = editionChipLabels({ library_platform: 'NES' }, '')
    expect(chip.abbrev).toBe(abbreviatePlatform('NES'))
    expect(chip.extra).toBe(0)
  })

  it('returns null when there is no system at all', () => {
    expect(editionChipLabels({}, '')).toBeNull()
  })
})
