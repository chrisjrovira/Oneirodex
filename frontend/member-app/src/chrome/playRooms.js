/**
 * Per-system "room" treatment (FEAT-D5) — client mirror of
 * `gametheca/utils/play_rooms.py`.
 *
 * Grouped by **setting**, not brand: a Mega Drive and a SNES shared a living
 * room; a Neo Geo cabinet did not. Brand grouping already exists in
 * `platformSkins` and is the right axis for library chrome — this is the other
 * question, "where were you sitting".
 *
 * Kept as a small static map rather than fetched: it is presentational, needed
 * during first paint, and a network round-trip to learn a background colour
 * would show an unstyled flash.
 */

export const ROOMS = {
  crt_living_room: {
    label: 'Living room CRT',
    backdrop: '#1a1410',
    glow: '#ffb765',
    accent: '#e8c07d',
    ambience: 'scanlines',
  },
  arcade_cabinet: {
    label: 'Arcade cabinet',
    backdrop: '#08060f',
    glow: '#ff2d6f',
    accent: '#25e0ff',
    ambience: 'marquee',
  },
  handheld: {
    label: 'Handheld',
    backdrop: '#20262b',
    glow: '#9bd67a',
    accent: '#c9d6a0',
    ambience: 'daylight',
  },
  disc_era: {
    label: 'Disc era',
    backdrop: '#0b1220',
    glow: '#3f9bff',
    accent: '#7fd3ff',
    ambience: 'cool',
  },
  desk: {
    label: 'Desk',
    backdrop: '#0d1410',
    glow: '#5ef08a',
    accent: '#a9f7c1',
    ambience: 'phosphor',
  },
}

export const DEFAULT_ROOM = 'crt_living_room'

const PLATFORM_ROOMS = {
  NES: 'crt_living_room',
  SNES: 'crt_living_room',
  N64: 'crt_living_room',
  SEGA_MD: 'crt_living_room',
  SEGA_MS: 'crt_living_room',
  SEGA_32X: 'crt_living_room',
  SEGA_SG1000: 'crt_living_room',
  ATARI_2600: 'crt_living_room',
  ATARI_5200: 'crt_living_room',
  ATARI_7800: 'crt_living_room',
  INTV: 'crt_living_room',
  COLECO: 'crt_living_room',
  CHAF: 'crt_living_room',
  O2EM: 'crt_living_room',
  VECTREX: 'crt_living_room',
  ASTROCADE: 'crt_living_room',
  ARCADIA: 'crt_living_room',
  CREATIVISION: 'crt_living_room',
  STUDIO2: 'crt_living_room',
  PCE: 'crt_living_room',
  SUPERGRAFX: 'crt_living_room',
  GX4000: 'crt_living_room',

  ARCADE: 'arcade_cabinet',
  NEOGEO: 'arcade_cabinet',
  NEOGEO_CD: 'arcade_cabinet',
  DAPHNE: 'arcade_cabinet',
  PINBALL: 'arcade_cabinet',

  GB: 'handheld',
  GBC: 'handheld',
  GBA: 'handheld',
  NDS: 'handheld',
  N3DS: 'handheld',
  LYNX: 'handheld',
  NGP: 'handheld',
  NGPC: 'handheld',
  WS: 'handheld',
  SUPERVISION: 'handheld',
  PSP: 'handheld',
  PSVITA: 'handheld',
  ADVISION: 'handheld',

  PSX: 'disc_era',
  PS2: 'disc_era',
  PS3: 'disc_era',
  SEGA_CD: 'disc_era',
  SEGA_SATURN: 'disc_era',
  SEGA_DC: 'disc_era',
  NGC: 'disc_era',
  WII: 'disc_era',
  THREEDO: 'disc_era',
  PCFX: 'disc_era',
  PCE_CD: 'disc_era',
  JAGUAR: 'disc_era',
  SWITCH: 'disc_era',

  PCWIN: 'desk',
  PCDOS: 'desk',
  MAC: 'desk',
  AMIGA: 'desk',
  VICE_X64SC: 'desk',
  VICE_X128: 'desk',
  VICE_XVIC: 'desk',
  VICE_XPLUS4: 'desk',
  VICE_XPET: 'desk',
}

export function roomIdForPlatform(platformId) {
  const key = String(platformId || '').trim().toUpperCase()
  return PLATFORM_ROOMS[key] || DEFAULT_ROOM
}

export function roomForPlatform(platformId) {
  return ROOMS[roomIdForPlatform(platformId)]
}

/**
 * Inline style for a surface. Returns custom properties only, so the caller
 * decides what to paint with them — nothing is applied globally.
 */
export function roomStyle(platformId) {
  const room = roomForPlatform(platformId)
  return {
    '--gt-room-backdrop': room.backdrop,
    '--gt-room-glow': room.glow,
    '--gt-room-accent': room.accent,
  }
}
