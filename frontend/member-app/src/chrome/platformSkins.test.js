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
    expect(familyForPlatform('SWITCH')).toBe('nintendo')
    expect(familyForPlatform('WII_U')).toBe('nintendo')
    expect(familyForPlatform('POKE_MINI')).toBe('nintendo')
    expect(familyForPlatform('PS2')).toBe('sony')
    expect(familyForPlatform('PSP')).toBe('sony')
    expect(familyForPlatform('XONE')).toBe('xbox')
    expect(familyForPlatform('SEGA_MD')).toBe('sega')
    expect(familyForPlatform('SEGA_SG1000')).toBe('sega')
    expect(familyForPlatform('SEGA_PICO')).toBe('sega')
    expect(familyForPlatform('PCWIN')).toBe('pc')
    expect(familyForPlatform('AMIGA')).toBe('pc')
    expect(familyForPlatform('AMIGA_CD32')).toBe('pc')
    expect(familyForPlatform('MSX')).toBe('pc')
    expect(familyForPlatform('ZX_SPECTRUM')).toBe('pc')
    expect(familyForPlatform('CPC')).toBe('pc')
    expect(familyForPlatform('ATARI_ST')).toBe('pc')
    expect(familyForPlatform('APPLE_II')).toBe('pc')
    expect(familyForPlatform('ATARI_8BIT')).toBe('pc')
    expect(familyForPlatform('X68000')).toBe('pc')
    expect(familyForPlatform('PC_98')).toBe('pc')
    expect(familyForPlatform('NEOGEO_CD')).toBe('atari')
    expect(familyForPlatform('NEOGEO')).toBe('atari')
    expect(familyForPlatform('ARCADE')).toBe('atari')
    expect(familyForPlatform('INTV')).toBe('atari')
    expect(familyForPlatform('SUPERGRAFX')).toBe('atari')
    expect(familyForPlatform('NGPC')).toBe('atari')
    for (const id of [
      'PCE_CD', 'SUPERVISION', 'GX4000', 'ASTROCADE', 'ARCADIA',
      'CREATIVISION', 'ADVISION', 'STUDIO2', 'ACTIONMAX', 'DAPHNE', 'PINBALL',
      'CD_I', 'JAGUAR_CD',
    ]) {
      expect(familyForPlatform(id)).toBe('atari')
    }
  })

  test('Wave-19 / W20-6 skin membership (Systems family grouping)', () => {
    expect(skinForPlatform('SWITCH')).toMatchObject({
      family: 'nintendo',
      platform: 'SWITCH',
      label: 'Nintendo',
    })
    expect(skinForPlatform('PSP')).toMatchObject({
      family: 'sony',
      platform: 'PSP',
      label: 'Sony',
    })
    expect(skinForPlatform('NEOGEO')).toMatchObject({
      family: 'atari',
      platform: 'NEOGEO',
      label: 'Retro',
    })
    expect(skinForPlatform('ARCADE')).toMatchObject({
      family: 'atari',
      platform: 'ARCADE',
      label: 'Retro',
    })
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
