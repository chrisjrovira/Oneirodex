import { describe, expect, it, vi, beforeEach } from 'vitest'

import { kickoffInstall } from './install.js'
import { createLifecycleRegistry } from './lifecycle.js'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('./config-store.js', () => ({
  isTauriRuntime: () => true,
}))

vi.mock('./install-store.js', () => ({
  loadInstallsFromDisk: vi.fn(),
  saveInstallsToDisk: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { loadInstallsFromDisk, saveInstallsToDisk } from './install-store.js'

describe('install helper', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(loadInstallsFromDisk).mockReset()
    vi.mocked(saveInstallsToDisk).mockReset()
  })

  it('extracts archive and transitions lifecycle to installed', async () => {
    const registry = createLifecycleRegistry()
    registry.apply('game-42', 'download')

    vi.mocked(loadInstallsFromDisk).mockResolvedValue({
      'game-42': {
        archivePath: '/appdata/downloads/game-42.zip',
        extractPath: '/appdata/installs/game-42',
      },
    })
    vi.mocked(invoke).mockResolvedValue({
      extract_path: '/appdata/installs/game-42',
      exe_path: '/appdata/installs/game-42/game.exe',
    })

    const next = await kickoffInstall(registry, 'game-42')

    expect(invoke).toHaveBeenCalledWith('extract_zip_archive', {
      archivePath: '/appdata/downloads/game-42.zip',
      destDir: '/appdata/installs/game-42',
    })
    expect(saveInstallsToDisk).toHaveBeenCalled()
    expect(next).toBe('installed')
    expect(registry.get('game-42')).toBe('installed')
  })
})
