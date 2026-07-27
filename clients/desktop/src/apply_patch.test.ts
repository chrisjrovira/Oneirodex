import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('./config-store.js', () => ({
  isTauriRuntime: () => true,
}))

import { invoke } from '@tauri-apps/api/core'
import {
  buildFlipsApplyArgs,
  isPatchFilename,
  patchedOutputName,
  resolvePatchStageDir,
  safePatchFilename,
  stagePatchFile,
} from './apply_patch.js'

describe('apply_patch helpers', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
  })

  it('sanitizes patch filenames', () => {
    expect(safePatchFilename('../evil.bps')).toBe('evil.bps')
    expect(safePatchFilename('')).toBe('patch.bps')
  })

  it('resolves stage dir under patches root', () => {
    expect(resolvePatchStageDir('/appdata/patches/', 'abc-123')).toBe(
      '/appdata/patches/abc-123',
    )
  })

  it('builds flips CLI args', () => {
    expect(
      buildFlipsApplyArgs({
        flipsPath: 'C:\\Tools\\flips.exe',
        patchPath: '/p/a.bps',
        romPath: '/p/game.sfc',
        outputPath: '/p/out.sfc',
      }),
    ).toEqual(['C:\\Tools\\flips.exe', '--apply', '/p/a.bps', '/p/game.sfc', '/p/out.sfc'])
  })

  it('detects patch extensions', () => {
    expect(isPatchFilename('x.bps')).toBe(true)
    expect(isPatchFilename('x.IPS')).toBe(true)
    expect(isPatchFilename('x.txt')).toBe(false)
  })

  it('names patched output', () => {
    expect(patchedOutputName('game.sfc', 'en.bps')).toBe('game.patched-bps.sfc')
  })

  it('stagePatchFile writes under app_data/patches via write_file_bytes', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'get_app_subdir') {
        return '/appdata/patches'
      }
      return undefined
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('BPS1').buffer,
    })) as unknown as typeof fetch

    const result = await stagePatchFile({
      gameUuid: 'game-42',
      patchUuid: 'patch-9',
      filename: 'en.bps',
      apiBase: 'https://gt.example',
      fetchImpl,
    })

    expect(result).toEqual({ ok: true, path: '/appdata/patches/game-42/en.bps' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gt.example/download_other/extra/game-42/patch-9',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(invoke).toHaveBeenCalledWith('write_file_bytes', {
      path: '/appdata/patches/game-42/en.bps',
      bytes: expect.any(Array),
    })
  })
})
