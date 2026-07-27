import {
  applyPlatformSkin,
  clearPlatformSkin,
  familyForPlatform,
  sharedPlatform,
  skinForPlatform,
} from './platformSkins'

describe('platformSkins', () => {
  afterEach(() => {
    clearPlatformSkin()
  })

  test('maps console families', () => {
    expect(familyForPlatform('NES')).toBe('nintendo')
    expect(familyForPlatform('PS2')).toBe('sony')
    expect(familyForPlatform('XONE')).toBe('xbox')
    expect(familyForPlatform('SEGA_MD')).toBe('sega')
    expect(familyForPlatform('PCWIN')).toBe('pc')
    expect(familyForPlatform('NEOGEO_CD')).toBe('atari')
    expect(familyForPlatform('INTV')).toBe('atari')
  })

  test('skinForPlatform returns accent and motion', () => {
    expect(skinForPlatform('NES')).toMatchObject({
      family: 'nintendo',
      motion: 'pixel',
      accent: '#e60012',
    })
    expect(skinForPlatform('PS5').motion).toBe('sheen')
  })

  test('applyPlatformSkin sets document attributes', () => {
    applyPlatformSkin('NES')
    expect(document.documentElement.getAttribute('data-platform')).toBe('NES')
    expect(document.documentElement.getAttribute('data-platform-family')).toBe('nintendo')
    expect(document.documentElement.style.getPropertyValue('--gt-platform-accent')).toBe('#e60012')
    clearPlatformSkin()
    expect(document.documentElement.getAttribute('data-platform')).toBeNull()
  })

  test('sharedPlatform requires unanimous library_platform', () => {
    expect(sharedPlatform([])).toBeNull()
    expect(sharedPlatform([{ library_platform: 'NES' }, { library_platform: 'NES' }])).toBe('NES')
    expect(sharedPlatform([{ library_platform: 'NES' }, { library_platform: 'PS2' }])).toBeNull()
  })
})
