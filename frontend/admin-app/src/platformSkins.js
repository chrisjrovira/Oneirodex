/** Platform family accents for Art Studio preview chrome (mirrors member-app). */

const NINTENDO = new Set([
  'NES', 'SNES', 'NGC', 'N64', 'GB', 'GBA', 'GBC', 'NDS', 'VB', 'WII', 'N3DS', 'SWITCH',
])
const SONY = new Set(['PSX', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'PSVITA'])
const XBOX = new Set(['XBOX', 'X360', 'XONE', 'XSX'])
const SEGA = new Set([
  'SEGA_MD', 'SEGA_MS', 'SEGA_CD', 'SEGA_32X', 'SEGA_GG', 'SEGA_SATURN', 'SEGA_DC',
])
const ATARI = new Set([
  'ATARI_7800', 'ATARI_5200', 'ATARI_2600', 'LYNX', 'JAGUAR',
  'PCE', 'PCFX', 'NGP', 'WS', 'COLECO', 'THREEDO', 'VECTREX',
  'VICE_X64SC', 'VICE_X128', 'VICE_XVIC', 'VICE_XPLUS4', 'VICE_XPET',
  'NEOGEO_CD', 'NEOGEO', 'INTV', 'CHAF', 'O2EM', 'ARCADE',
])
const PC = new Set(['PCWIN', 'PCDOS', 'MAC', 'OTHER'])

const FAMILY_BY_PLATFORM = {
  nintendo: NINTENDO,
  sony: SONY,
  xbox: XBOX,
  sega: SEGA,
  atari: ATARI,
  pc: PC,
}

const FAMILY_META = {
  nintendo: { family: 'nintendo', accent: '#e60012', label: 'Nintendo' },
  sony: { family: 'sony', accent: '#0070d1', label: 'Sony' },
  xbox: { family: 'xbox', accent: '#2fd67b', label: 'Xbox' },
  sega: { family: 'sega', accent: '#1a66ff', label: 'Sega' },
  atari: { family: 'atari', accent: '#f5a623', label: 'Retro' },
  pc: { family: 'pc', accent: '#2fd67b', label: 'PC' },
}

/** Common systems for Art Studio selector (id → short label). */
export const ART_STUDIO_SYSTEMS = [
  { id: '', label: 'Generic (aurora)' },
  { id: 'NES', label: 'NES' },
  { id: 'SNES', label: 'SNES' },
  { id: 'N64', label: 'N64' },
  { id: 'NGC', label: 'GameCube' },
  { id: 'WII', label: 'Wii' },
  { id: 'GB', label: 'Game Boy' },
  { id: 'GBC', label: 'Game Boy Color' },
  { id: 'GBA', label: 'GBA' },
  { id: 'NDS', label: 'Nintendo DS' },
  { id: 'N3DS', label: '3DS' },
  { id: 'SWITCH', label: 'Switch' },
  { id: 'SEGA_MD', label: 'Genesis / Mega Drive' },
  { id: 'SEGA_SATURN', label: 'Saturn' },
  { id: 'SEGA_DC', label: 'Dreamcast' },
  { id: 'PSX', label: 'PlayStation' },
  { id: 'PS2', label: 'PS2' },
  { id: 'PS3', label: 'PS3' },
  { id: 'PSP', label: 'PSP' },
  { id: 'XBOX', label: 'Xbox' },
  { id: 'X360', label: 'Xbox 360' },
  { id: 'PCWIN', label: 'PC Windows' },
  { id: 'ARCADE', label: 'Arcade' },
  { id: 'ATARI_2600', label: 'Atari 2600' },
]

export function platformFamily(platformId) {
  if (!platformId) return null
  const id = String(platformId).toUpperCase()
  for (const [family, members] of Object.entries(FAMILY_BY_PLATFORM)) {
    if (members.has(id)) return family
  }
  return 'pc'
}

export function skinForPlatform(platformId) {
  if (!platformId) return null
  const family = platformFamily(platformId) || 'pc'
  return {
    ...FAMILY_META[family],
    platform: String(platformId).toUpperCase(),
  }
}

export function systemLabel(platformId) {
  if (!platformId) return ''
  const hit = ART_STUDIO_SYSTEMS.find((s) => s.id === platformId)
  return hit?.label || platformId
}
