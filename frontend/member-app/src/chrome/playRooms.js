/**
 * Per-system "room" treatment (FEAT-D5) — client mirror of
 * `oneirodex/utils/play_rooms.py`.
 *
 * Two layers: the **bezel** is the hardware (platform skins); the **room** is
 * the place and decade. A Mega Drive and a SNES shared a 1990s teen bedroom;
 * a Neo Geo cabinet did not. Brand grouping already exists in `platformSkins`
 * and is the right axis for library chrome.
 *
 * Kept as a small static map rather than fetched: it is presentational, needed
 * during first paint, and a network round-trip to learn a background colour
 * would show an unstyled flash.
 */

export const ROOMS = {
  wood_den_80s: {
    label: '1980s wood den',
    blurb: 'Family television, wood panel, harvest lamp.',
    backdrop: '#1a1410',
    glow: '#ffb765',
    accent: '#e8c07d',
    ambience: 'scanlines',
  },
  teen_bedroom_90s: {
    label: '1990s teen bedroom',
    blurb: 'Posters, carpet, afternoon window, console on the floor.',
    backdrop: '#1c1524',
    glow: '#d4a574',
    accent: '#c9a0d4',
    ambience: 'daylight',
  },
  carpet_den_late_90s: {
    label: 'Late-90s carpet den',
    blurb: 'Basement rec room, disc cases, tube still in the corner.',
    backdrop: '#121018',
    glow: '#6a8cff',
    accent: '#9bb0ff',
    ambience: 'cool',
  },
  media_center_00s: {
    label: '2000s media centre',
    blurb: 'Silver-black stand, tray-loading boxes, evening window.',
    backdrop: '#0b1220',
    glow: '#3f9bff',
    accent: '#7fd3ff',
    ambience: 'cool',
  },
  arcade_cabinet: {
    label: 'Arcade floor',
    blurb: 'Dark room, marquee overhead, coins on the bezel.',
    backdrop: '#08060f',
    glow: '#ff2d6f',
    accent: '#25e0ff',
    ambience: 'marquee',
  },
  desk: {
    label: 'Computer desk',
    blurb: 'Home computer, desk lamp, phosphor glow.',
    backdrop: '#0d1410',
    glow: '#5ef08a',
    accent: '#a9f7c1',
    ambience: 'phosphor',
  },
}

export const DEFAULT_ROOM = 'wood_den_80s'

export const LCD_PLATFORMS = {
  GB: 1,
  GBC: 1,
  GBA: 1,
  NDS: 1,
  N3DS: 1,
  PSP: 1,
  PSVITA: 1,
  LYNX: 1,
  NGP: 1,
  NGPC: 1,
  WS: 1,
  SUPERVISION: 1,
  ADVISION: 1,
  SEGA_GG: 1,
  POKE_MINI: 1,
  GAME_WATCH: 1,
}

const PLATFORM_ROOMS = {
  NES: 'wood_den_80s',
  SEGA_MS: 'wood_den_80s',
  SEGA_SG1000: 'wood_den_80s',
  GAME_WATCH: 'wood_den_80s',
  ATARI_2600: 'wood_den_80s',
  ATARI_5200: 'wood_den_80s',
  ATARI_7800: 'wood_den_80s',
  INTV: 'wood_den_80s',
  COLECO: 'wood_den_80s',
  CHAF: 'wood_den_80s',
  O2EM: 'wood_den_80s',
  VECTREX: 'wood_den_80s',
  ASTROCADE: 'wood_den_80s',
  ARCADIA: 'wood_den_80s',
  CREATIVISION: 'wood_den_80s',
  STUDIO2: 'wood_den_80s',
  PCE: 'wood_den_80s',
  SUPERGRAFX: 'wood_den_80s',
  GX4000: 'wood_den_80s',

  SNES: 'teen_bedroom_90s',
  SEGA_MD: 'teen_bedroom_90s',
  SEGA_32X: 'teen_bedroom_90s',
  GB: 'teen_bedroom_90s',
  GBC: 'teen_bedroom_90s',
  SEGA_GG: 'teen_bedroom_90s',
  LYNX: 'teen_bedroom_90s',
  NGP: 'teen_bedroom_90s',
  NGPC: 'teen_bedroom_90s',
  WS: 'teen_bedroom_90s',
  SUPERVISION: 'teen_bedroom_90s',
  ADVISION: 'teen_bedroom_90s',
  VB: 'teen_bedroom_90s',
  SEGA_PICO: 'teen_bedroom_90s',

  N64: 'carpet_den_late_90s',
  PSX: 'carpet_den_late_90s',
  SEGA_SATURN: 'carpet_den_late_90s',
  SEGA_CD: 'carpet_den_late_90s',
  JAGUAR: 'carpet_den_late_90s',
  THREEDO: 'carpet_den_late_90s',
  PCFX: 'carpet_den_late_90s',
  PCE_CD: 'carpet_den_late_90s',
  JAGUAR_CD: 'carpet_den_late_90s',
  CD_I: 'carpet_den_late_90s',
  AMIGA_CD32: 'carpet_den_late_90s',

  PS2: 'media_center_00s',
  PS3: 'media_center_00s',
  NGC: 'media_center_00s',
  WII: 'media_center_00s',
  SEGA_DC: 'media_center_00s',
  SWITCH: 'media_center_00s',
  WII_U: 'media_center_00s',
  XBOX: 'media_center_00s',
  X360: 'media_center_00s',
  XONE: 'media_center_00s',
  XSX: 'media_center_00s',
  GBA: 'media_center_00s',
  NDS: 'media_center_00s',
  N3DS: 'media_center_00s',
  PSP: 'media_center_00s',
  PSVITA: 'media_center_00s',
  POKE_MINI: 'media_center_00s',

  ARCADE: 'arcade_cabinet',
  NEOGEO: 'arcade_cabinet',
  NEOGEO_CD: 'arcade_cabinet',
  DAPHNE: 'arcade_cabinet',
  PINBALL: 'arcade_cabinet',

  PCWIN: 'desk',
  PCDOS: 'desk',
  MAC: 'desk',
  AMIGA: 'desk',
  VICE_X64SC: 'desk',
  VICE_X128: 'desk',
  VICE_XVIC: 'desk',
  VICE_XPLUS4: 'desk',
  VICE_XPET: 'desk',
  MSX: 'desk',
  ZX_SPECTRUM: 'desk',
  CPC: 'desk',
  ATARI_ST: 'desk',
  APPLE_II: 'desk',
  ATARI_8BIT: 'desk',
  X68000: 'desk',
  PC_98: 'desk',
  BBC_MICRO: 'desk',
}

export function roomIdForPlatform(platformId) {
  const key = String(platformId || '').trim().toUpperCase()
  return PLATFORM_ROOMS[key] || DEFAULT_ROOM
}

export function roomForPlatform(platformId) {
  return ROOMS[roomIdForPlatform(platformId)]
}

export function isLcdPlatform(platformId) {
  const key = String(platformId || '').trim().toUpperCase()
  return Boolean(LCD_PLATFORMS[key])
}

/**
 * Inline style for a surface. Returns custom properties only, so the caller
 * decides what to paint with them — nothing is applied globally.
 */
export function roomStyle(platformId) {
  const room = roomForPlatform(platformId)
  return {
    '--od-room-backdrop': room.backdrop,
    '--od-room-glow': room.glow,
    '--od-room-accent': room.accent,
  }
}
