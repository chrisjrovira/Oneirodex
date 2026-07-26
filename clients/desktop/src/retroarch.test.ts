import { describe, expect, it } from 'vitest'

import {
  HANDHELD_PRESETS,
  buildRetroArchArgs,
  wineLaunchEnv,
} from './retroarch.js'

describe('retroarch companion helpers', () => {
  it('builds -L core rom args', () => {
    expect(
      buildRetroArchArgs({
        core: '/cores/dolphin_libretro.so',
        system: 'NGC',
        romPath: '/roms/game.iso',
      }),
    ).toEqual(['-L', '/cores/dolphin_libretro.so', '/roms/game.iso'])
  })

  it('exposes handheld presets', () => {
    expect(HANDHELD_PRESETS.some((p) => p.id === 'steamdeck')).toBe(true)
  })

  it('builds wine prefix env', () => {
    expect(wineLaunchEnv({ prefixPath: '/home/u/.wine-gt', dxvk: true })).toMatchObject({
      WINEPREFIX: '/home/u/.wine-gt',
      DXVK_HUD: '0',
    })
  })
})
