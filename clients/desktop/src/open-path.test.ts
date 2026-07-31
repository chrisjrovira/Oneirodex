import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import {
  isAbsoluteOsPath,
  isRevealAllowedUnderRoots,
  revealPathInOs,
  validateRevealPath,
} from './open-path.js'

describe('open-path validation', () => {
  it('accepts Windows drive, UNC, and Unix absolute paths', () => {
    expect(isAbsoluteOsPath('C:\\Games\\Foo')).toBe(true)
    expect(isAbsoluteOsPath('Z:/games/bar')).toBe(true)
    expect(isAbsoluteOsPath('\\\\nas\\share\\games')).toBe(true)
    expect(isAbsoluteOsPath('/mnt/user/games/Foo')).toBe(true)
  })

  it('rejects relative and empty paths', () => {
    expect(isAbsoluteOsPath('')).toBe(false)
    expect(isAbsoluteOsPath('games\\Foo')).toBe(false)
    expect(isAbsoluteOsPath('./Foo')).toBe(false)
    expect(validateRevealPath('  ')).toEqual({ ok: false, error: 'Path is required' })
    expect(validateRevealPath('relative\\path').ok).toBe(false)
  })

  it('rejects control characters and .. segments', () => {
    expect(validateRevealPath('C:\\Games\\Foo\0bar').ok).toBe(false)
    expect(validateRevealPath('C:\\Games\\..\\Windows').ok).toBe(false)
    expect(validateRevealPath('C:\\Games\\Foo\\..\\Bar').ok).toBe(false)
  })

  it('enforces optional allowed roots for local installs', () => {
    const root = 'C:\\GameTheca\\installs'
    expect(isRevealAllowedUnderRoots(`${root}\\game-1`, [root])).toBe(true)
    expect(isRevealAllowedUnderRoots('C:\\Windows\\System32', [root])).toBe(false)
    expect(isRevealAllowedUnderRoots('C:\\Windows\\System32', [])).toBe(true)
  })
})

describe('revealPathInOs', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
  })

  it('invokes Tauri reveal with validated absolute path', async () => {
    vi.mocked(invoke).mockResolvedValue({
      path: 'C:\\GameTheca\\installs\\game-1',
      revealed_as: 'directory',
    })
    const result = await revealPathInOs('C:\\GameTheca\\installs\\game-1')
    expect(result).toEqual({
      ok: true,
      path: 'C:\\GameTheca\\installs\\game-1',
      revealed_as: 'directory',
    })
    expect(invoke).toHaveBeenCalledWith('reveal_path_in_os', {
      path: 'C:\\GameTheca\\installs\\game-1',
      select: true,
    })
  })

  it('returns validation errors without invoking Tauri', async () => {
    const result = await revealPathInOs('../evil')
    expect(result.ok).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('blocks paths outside allowedRoots', async () => {
    const result = await revealPathInOs('C:\\Windows', {
      allowedRoots: ['C:\\GameTheca\\installs'],
    })
    expect(result).toEqual({ ok: false, error: 'Path is outside allowed roots' })
    expect(invoke).not.toHaveBeenCalled()
  })
})
