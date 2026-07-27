import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createLifecycleRegistry } from './lifecycle.js'
import { kickoffUninstall, kickoffUpdate } from './uninstall.js'

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

vi.mock('./install.js', () => ({
  getInstallRecord: vi.fn(),
  extractInstallArchive: vi.fn(),
}))

vi.mock('./download.js', () => ({
  downloadGameArchive: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { downloadGameArchive } from './download.js'
import { extractInstallArchive, getInstallRecord } from './install.js'
import { loadInstallsFromDisk, saveInstallsToDisk } from './install-store.js'

describe('uninstall helper', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(loadInstallsFromDisk).mockReset()
    vi.mocked(saveInstallsToDisk).mockReset()
    vi.mocked(getInstallRecord).mockReset()
    vi.mocked(extractInstallArchive).mockReset()
    vi.mocked(downloadGameArchive).mockReset()
  })

  it('removes extract path, staging, and archive then clears registry to not_downloaded', async () => {
    const registry = createLifecycleRegistry()
    registry.apply('game-7', 'download')
    registry.apply('game-7', 'install')

    vi.mocked(getInstallRecord).mockResolvedValue({
      archivePath: '/appdata/downloads/game-7.zip',
      extractPath: '/appdata/installs/game-7',
      exePath: '/appdata/installs/game-7/game.exe',
    })
    vi.mocked(loadInstallsFromDisk).mockResolvedValue({
      'game-7': {
        archivePath: '/appdata/downloads/game-7.zip',
        extractPath: '/appdata/installs/game-7',
      },
    })
    vi.mocked(invoke).mockResolvedValue(undefined)

    const next = await kickoffUninstall(registry, 'game-7')

    expect(invoke).toHaveBeenCalledWith('remove_path', {
      path: '/appdata/installs/game-7',
    })
    expect(invoke).toHaveBeenCalledWith('remove_path', {
      path: '/appdata/installs/game-7.staging',
    })
    expect(invoke).toHaveBeenCalledWith('remove_path', {
      path: '/appdata/downloads/game-7.zip',
    })
    expect(saveInstallsToDisk).toHaveBeenCalledWith({})
    expect(next).toBe('not_downloaded')
    expect(registry.get('game-7')).toBe('not_downloaded')
  })
})

describe('update helper', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(loadInstallsFromDisk).mockReset()
    vi.mocked(saveInstallsToDisk).mockReset()
    vi.mocked(getInstallRecord).mockReset()
    vi.mocked(extractInstallArchive).mockReset()
    vi.mocked(downloadGameArchive).mockReset()
  })

  it('extracts to staging then renames into place', async () => {
    const registry = createLifecycleRegistry()
    registry.apply('game-9', 'download')
    registry.apply('game-9', 'install')
    registry.signalUpdateAvailable('game-9')

    vi.mocked(getInstallRecord).mockResolvedValue({
      archivePath: '/appdata/downloads/game-9.zip',
      extractPath: '/appdata/installs/game-9',
      exePath: '/appdata/installs/game-9/old.exe',
    })
    vi.mocked(downloadGameArchive).mockResolvedValue({
      archivePath: '/appdata/downloads/game-9.zip',
      extractPath: '/appdata/installs/game-9',
    })
    vi.mocked(extractInstallArchive).mockResolvedValue({
      archivePath: '/appdata/downloads/game-9.zip',
      extractPath: '/appdata/installs/game-9.staging',
      exePath: '/appdata/installs/game-9.staging/game.exe',
    })
    vi.mocked(loadInstallsFromDisk).mockResolvedValue({})
    vi.mocked(invoke).mockResolvedValue(undefined)

    const api = {} as never
    const auth = {} as never
    const next = await kickoffUpdate(api, auth, registry, 'game-9')

    expect(extractInstallArchive).toHaveBeenCalledWith(
      'game-9',
      expect.objectContaining({ extractPath: '/appdata/installs/game-9.staging' }),
    )
    expect(invoke).toHaveBeenCalledWith('remove_path', {
      path: '/appdata/installs/game-9',
    })
    expect(invoke).toHaveBeenCalledWith('rename_path', {
      from: '/appdata/installs/game-9.staging',
      to: '/appdata/installs/game-9',
    })
    expect(saveInstallsToDisk).toHaveBeenCalledWith({
      'game-9': {
        archivePath: '/appdata/downloads/game-9.zip',
        extractPath: '/appdata/installs/game-9',
        exePath: '/appdata/installs/game-9/game.exe',
      },
    })
    expect(next).toBe('installed')
    expect(registry.get('game-9')).toBe('installed')
  })
})
