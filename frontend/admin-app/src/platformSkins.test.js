import { ART_STUDIO_SYSTEMS, platformFamily, skinForPlatform, systemLabel } from './platformSkins'

test('maps platforms to family accents for Art Studio chrome', () => {
  expect(platformFamily('SNES')).toBe('nintendo')
  expect(platformFamily('SWITCH')).toBe('nintendo')
  expect(platformFamily('PS2')).toBe('sony')
  expect(platformFamily('PSP')).toBe('sony')
  expect(platformFamily('X360')).toBe('xbox')
  expect(platformFamily('SEGA_MD')).toBe('sega')
  expect(platformFamily('NEOGEO')).toBe('atari')
  expect(platformFamily('ARCADE')).toBe('atari')
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
})
