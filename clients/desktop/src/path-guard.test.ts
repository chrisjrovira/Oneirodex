import { describe, expect, it } from 'vitest'

import { isPathUnderRoot } from './path-guard.js'

describe('path guard', () => {
  const root = 'C:\\Oneirodex\\installs'

  it('accepts paths inside the installs root', () => {
    expect(isPathUnderRoot(`${root}\\game-42\\game.exe`, root)).toBe(true)
    expect(isPathUnderRoot(`${root}\\game-42`, root)).toBe(true)
  })

  it('rejects traversal outside the installs root', () => {
    expect(isPathUnderRoot(`${root}\\..\\downloads\\evil.exe`, root)).toBe(false)
    expect(isPathUnderRoot('C:\\Windows\\System32\\cmd.exe', root)).toBe(false)
  })
})
