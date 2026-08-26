import { expect, test } from 'vitest'
import {
  DEFAULT_ROOM,
  ROOMS,
  roomForPlatform,
  roomIdForPlatform,
  roomStyle,
} from './playRooms'
import { familyForPlatform } from './platformSkins'

test('groups by setting, which cuts across brand families', () => {
  // The whole point: brand grouping already exists and answers a different
  // question. A SNES and a Mega Drive shared a living room.
  expect(roomIdForPlatform('SNES')).toBe(roomIdForPlatform('SEGA_MD'))
  expect(familyForPlatform('SNES')).not.toBe(familyForPlatform('SEGA_MD'))
})

test('arcade hardware is its own setting', () => {
  expect(roomIdForPlatform('ARCADE')).toBe('arcade_cabinet')
  expect(roomIdForPlatform('NEOGEO')).toBe('arcade_cabinet')
  expect(roomIdForPlatform('ARCADE')).not.toBe(roomIdForPlatform('SNES'))
})

test('nineties handhelds share the teen bedroom, later pockets the media centre', () => {
  for (const key of ['GB', 'LYNX', 'NGP', 'WS']) {
    expect(roomIdForPlatform(key)).toBe('teen_bedroom_90s')
  }
  expect(roomIdForPlatform('PSP')).toBe('media_center_00s')
})

test('late-nineties disc generation is the carpet den', () => {
  expect(roomIdForPlatform('PSX')).toBe('carpet_den_late_90s')
  expect(roomIdForPlatform('SEGA_SATURN')).toBe('carpet_den_late_90s')
  expect(roomIdForPlatform('PSX')).not.toBe(roomIdForPlatform('NES'))
  expect(roomIdForPlatform('NGC')).toBe('media_center_00s')
})

test('computers land on the desk', () => {
  for (const key of ['PCDOS', 'AMIGA', 'VICE_X64SC']) {
    expect(roomIdForPlatform(key)).toBe('desk')
  }
})

test('unknown platform gets a plausible default rather than breaking', () => {
  expect(roomIdForPlatform('SOME_FUTURE_CONSOLE')).toBe(DEFAULT_ROOM)
  expect(roomIdForPlatform(null)).toBe(DEFAULT_ROOM)
  expect(roomIdForPlatform('')).toBe(DEFAULT_ROOM)
})

test('lookup is case insensitive', () => {
  expect(roomIdForPlatform('psx')).toBe(roomIdForPlatform('PSX'))
})

test('every room defines the full palette', () => {
  for (const [id, room] of Object.entries(ROOMS)) {
    for (const key of ['backdrop', 'glow', 'accent', 'ambience', 'label']) {
      expect(room[key], `${id}.${key}`).toBeTruthy()
    }
  }
})

test('roomStyle returns custom properties only, so nothing leaks globally', () => {
  const style = roomStyle('ARCADE')
  expect(Object.keys(style).every((k) => k.startsWith('--gt-room-'))).toBe(true)
  expect(style['--gt-room-backdrop']).toBe(ROOMS.arcade_cabinet.backdrop)
})

test('roomForPlatform returns the room object', () => {
  expect(roomForPlatform('NES')).toBe(ROOMS.wood_den_80s)
})
