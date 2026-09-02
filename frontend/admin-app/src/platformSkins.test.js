import { ART_STUDIO_SYSTEMS, platformFamily, skinForPlatform, systemLabel } from './platformSkins'

test('maps platforms to family accents for Art Studio chrome', () => {
  expect(platformFamily('SNES')).toBe('nintendo')
  expect(platformFamily('SWITCH')).toBe('nintendo')
  expect(platformFamily('WII_U')).toBe('nintendo')
  expect(platformFamily('POKE_MINI')).toBe('nintendo')
  expect(platformFamily('GAME_WATCH')).toBe('nintendo')
  expect(platformFamily('PS2')).toBe('sony')
  expect(platformFamily('PSP')).toBe('sony')
  expect(platformFamily('X360')).toBe('xbox')
  expect(platformFamily('SEGA_MD')).toBe('sega')
  expect(platformFamily('SEGA_SG1000')).toBe('sega')
  expect(platformFamily('SEGA_PICO')).toBe('sega')
  expect(platformFamily('NEOGEO')).toBe('atari')
  expect(platformFamily('ARCADE')).toBe('atari')
  expect(platformFamily('SUPERGRAFX')).toBe('atari')
  expect(platformFamily('NGPC')).toBe('atari')
  expect(platformFamily('AMIGA')).toBe('pc')
  expect(platformFamily('AMIGA_CD32')).toBe('pc')
  expect(platformFamily('MSX')).toBe('pc')
  expect(platformFamily('CPC')).toBe('pc')
  expect(platformFamily('ZX_SPECTRUM')).toBe('pc')
  expect(platformFamily('ATARI_ST')).toBe('pc')
  expect(platformFamily('APPLE_II')).toBe('pc')
  expect(platformFamily('ATARI_8BIT')).toBe('pc')
  expect(platformFamily('X68000')).toBe('pc')
  expect(platformFamily('PC_98')).toBe('pc')
  expect(platformFamily('BBC_MICRO')).toBe('pc')
  for (const id of [
    'PCE_CD', 'SUPERVISION', 'GX4000', 'ASTROCADE', 'ARCADIA',
    'CREATIVISION', 'ADVISION', 'STUDIO2', 'ACTIONMAX', 'DAPHNE', 'PINBALL',
    'CD_I', 'JAGUAR_CD',
  ]) {
    expect(platformFamily(id)).toBe('atari')
  }
  expect(skinForPlatform('SNES')).toMatchObject({
    family: 'nintendo',
    accent: '#e60012',
    label: 'Nintendo',
  })
  expect(skinForPlatform('SWITCH')).toMatchObject({
    family: 'nintendo',
    platform: 'SWITCH',
    label: 'Nintendo',
  })
  expect(skinForPlatform('')).toBeNull()
  expect(systemLabel('SNES')).toBe('SNES')
  expect(ART_STUDIO_SYSTEMS.some((s) => s.id === 'SNES')).toBe(true)
  expect(ART_STUDIO_SYSTEMS.some((s) => s.id === 'SWITCH')).toBe(true)
  expect(ART_STUDIO_SYSTEMS.some((s) => s.id === 'WII_U')).toBe(true)
})
