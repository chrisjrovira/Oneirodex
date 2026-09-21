/**
 * Platform family table for system-aware chrome — shared by the member SPA
 * (`chrome/platformSkins.ts`, which paints `data-platform-*` and
 * `--od-platform-accent` on <html>) and the admin SPA (Art Studio preview).
 *
 * v11 cycle H-T (T2): this table used to be copied into both apps and had
 * drifted (`pc` accent, null semantics). The *table* and the family metadata
 * are the shared truth; each app keeps its own thin wrappers because their
 * fallbacks genuinely differ (member returns null for an unknown platform,
 * admin falls back to the pc accent for its preview).
 */

export type PlatformFamily = 'nintendo' | 'sony' | 'xbox' | 'sega' | 'atari' | 'pc'

export interface FamilyMeta {
  family: PlatformFamily
  /** Hex accent, or '' for "no platform accent — inherit the theme". */
  accent: string
  /** Loading-motif / chrome motion language for `data-platform-motion`. */
  motion: 'pixel' | 'sheen' | 'pulse' | 'bounce' | 'crt' | 'none'
  label: string
}

const NINTENDO = new Set([
  'NES',
  'SNES',
  'NGC',
  'N64',
  'GB',
  'GBA',
  'GBC',
  'NDS',
  'VB',
  'WII',
  'N3DS',
  'SWITCH',
  'WII_U',
  'POKE_MINI',
  'GAME_WATCH',
])
const SONY = new Set(['PSX', 'PS2', 'PS3', 'PS4', 'PS5', 'PSP', 'PSVITA'])
const XBOX = new Set(['XBOX', 'X360', 'XONE', 'XSX'])
const SEGA = new Set([
  'SEGA_MD',
  'SEGA_MS',
  'SEGA_CD',
  'SEGA_32X',
  'SEGA_GG',
  'SEGA_SATURN',
  'SEGA_DC',
  'SEGA_SG1000',
  'SEGA_PICO',
])
const ATARI = new Set([
  'ATARI_7800',
  'ATARI_5200',
  'ATARI_2600',
  'LYNX',
  'JAGUAR',
  'PCE',
  'PCFX',
  'NGP',
  'WS',
  'COLECO',
  'THREEDO',
  'VECTREX',
  'VICE_X64SC',
  'VICE_X128',
  'VICE_XVIC',
  'VICE_XPLUS4',
  'VICE_XPET',
  'NEOGEO_CD',
  'NEOGEO',
  'INTV',
  'CHAF',
  'O2EM',
  'ARCADE',
  'SUPERGRAFX',
  'PCE_CD',
  'NGPC',
  'SUPERVISION',
  'GX4000',
  'ASTROCADE',
  'ARCADIA',
  'CREATIVISION',
  'ADVISION',
  'STUDIO2',
  'ACTIONMAX',
  'DAPHNE',
  'PINBALL',
  'CD_I',
  'JAGUAR_CD',
])
const PC = new Set([
  'PCWIN',
  'PCDOS',
  'MAC',
  'OTHER',
  'AMIGA',
  'AMIGA_CD32',
  'MSX',
  'ZX_SPECTRUM',
  'CPC',
  'ATARI_ST',
  'APPLE_II',
  'ATARI_8BIT',
  'X68000',
  'PC_98',
  'BBC_MICRO',
])

export const FAMILY_BY_PLATFORM: Record<PlatformFamily, Set<string>> = {
  nintendo: NINTENDO,
  sony: SONY,
  xbox: XBOX,
  sega: SEGA,
  atari: ATARI,
  pc: PC,
}

export const FAMILY_META: Record<PlatformFamily, FamilyMeta> = {
  nintendo: {
    family: 'nintendo',
    accent: '#e60012',
    motion: 'pixel',
    label: 'Nintendo',
  },
  sony: {
    family: 'sony',
    accent: '#0070d1',
    motion: 'sheen',
    label: 'Sony',
  },
  xbox: {
    family: 'xbox',
    accent: '#2fd67b',
    motion: 'pulse',
    label: 'Xbox',
  },
  sega: {
    family: 'sega',
    accent: '#1a66ff',
    motion: 'bounce',
    label: 'Sega',
  },
  atari: {
    family: 'atari',
    accent: '#f5a623',
    motion: 'crt',
    label: 'Retro',
  },
  pc: {
    family: 'pc',
    accent: '',
    motion: 'none',
    label: 'PC',
  },
}

export function platformFamily(platformId: unknown): PlatformFamily | null {
  if (!platformId) {
    return null
  }
  const id = String(platformId).toUpperCase()
  for (const [family, members] of Object.entries(FAMILY_BY_PLATFORM)) {
    if (members.has(id)) {
      return family as PlatformFamily
    }
  }
  return 'pc'
}
