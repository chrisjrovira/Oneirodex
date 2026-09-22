/** Platform family accents for Art Studio preview chrome. Table + metadata come
 * from `@oneirodex/ui` (T2); this file keeps only what Art Studio adds. */
import { FAMILY_META, platformFamily } from '@oneirodex/ui'
import type { PlatformFamily } from '@oneirodex/ui'

export { platformFamily } from '@oneirodex/ui'

/** Art Studio previews always paint an accent; the generic room uses the system green. */
const PREVIEW_DEFAULT_ACCENT = '#2fd67b'

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
  { id: 'WII_U', label: 'Wii U' },
  { id: 'POKE_MINI', label: 'Pokémon Mini' },
  { id: 'SEGA_MD', label: 'Genesis / Mega Drive' },
  { id: 'SEGA_SATURN', label: 'Saturn' },
  { id: 'SEGA_DC', label: 'Dreamcast' },
  { id: 'SEGA_PICO', label: 'Sega Pico' },
  { id: 'PSX', label: 'PlayStation' },
  { id: 'PS2', label: 'PS2' },
  { id: 'PS3', label: 'PS3' },
  { id: 'PSP', label: 'PSP' },
  { id: 'XBOX', label: 'Xbox' },
  { id: 'X360', label: 'Xbox 360' },
  { id: 'PCWIN', label: 'PC Windows' },
  { id: 'ARCADE', label: 'Arcade' },
  { id: 'ATARI_2600', label: 'Atari 2600' },
  { id: 'CD_I', label: 'Philips CD-i' },
  { id: 'JAGUAR_CD', label: 'Jaguar CD' },
  { id: 'AMIGA_CD32', label: 'Amiga CD32' },
  { id: 'MSX', label: 'MSX' },
  { id: 'ZX_SPECTRUM', label: 'ZX Spectrum' },
  { id: 'CPC', label: 'Amstrad CPC' },
  { id: 'ATARI_ST', label: 'Atari ST' },
  { id: 'APPLE_II', label: 'Apple II' },
  { id: 'ATARI_8BIT', label: 'Atari 8-bit' },
  { id: 'X68000', label: 'Sharp X68000' },
  { id: 'PC_98', label: 'NEC PC-98' },
  { id: 'BBC_MICRO', label: 'BBC Micro' },
  { id: 'GAME_WATCH', label: 'Game & Watch' },
]

export function skinForPlatform(platformId: unknown) {
  if (!platformId) return null
  const family: PlatformFamily = platformFamily(platformId) || 'pc'
  const meta = FAMILY_META[family]
  return {
    ...meta,
    accent: meta.accent || PREVIEW_DEFAULT_ACCENT,
    platform: String(platformId).toUpperCase(),
  }
}

export function systemLabel(platformId: unknown) {
  if (!platformId) return ''
  const hit = ART_STUDIO_SYSTEMS.find((s) => s.id === platformId)
  return hit?.label || String(platformId)
}
