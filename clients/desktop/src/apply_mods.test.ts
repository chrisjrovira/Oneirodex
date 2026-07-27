import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('./config-store.js', () => ({
  isTauriRuntime: () => true,
}))

vi.mock('./install-store.js', () => ({
  loadInstallsFromDisk: vi.fn(async () => ({
    'game-42': { extractPath: 'C:\\GameTheca\\installs\\game-42', archivePath: 'x.zip' },
  })),
}))

import { invoke } from '@tauri-apps/api/core'
import {
  fetchGameMods,
  fetchModsSummaryGameUuids,
  isModArchiveFilename,
  kickoffApplyModPack,
  modApplyBlockedReason,
  modApplyUiHint,
  pickModFilename,
  resolveModApplyPath,
  resolveModStageDir,
  safeModFilename,
  safeModRelativePath,
  sortEnabledMods,
  stageModFromUrl,
} from './apply_mods.js'

describe('apply_mods helpers', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
  })

  it('sanitizes mod filenames and relative paths', () => {
    expect(safeModFilename('../evil.dll')).toBe('evil.dll')
    expect(safeModRelativePath('textures/hd.png')).toBe('textures/hd.png')
    expect(safeModRelativePath('../escape')).toBeNull()
  })

  it('resolves stage dir under mods root', () => {
    expect(resolveModStageDir('/appdata/mods/', 'abc-123', 'mod-9')).toBe(
      '/appdata/mods/abc-123/mod-9',
    )
  })

  it('resolves apply paths only under install root', () => {
    const root = 'C:\\GameTheca\\installs\\game-42'
    expect(resolveModApplyPath(root, 'mods/foo.dll')).toBe(
      'C:\\GameTheca\\installs\\game-42\\mods\\foo.dll',
    )
    expect(resolveModApplyPath(root, '..\\..\\windows\\system32')).toBeNull()
  })

  it('detects mod archives', () => {
    expect(isModArchiveFilename('pack.zip')).toBe(true)
    expect(isModArchiveFilename('pack.7Z')).toBe(true)
    expect(isModArchiveFilename('readme.txt')).toBe(false)
  })

  it('sorts enabled mods by load order', () => {
    const sorted = sortEnabledMods([
      { id: 'b', name: 'B', version: '', source_url: 'https://x/b.zip', enabled: true, load_order: 2 },
      { id: 'a', name: 'A', version: '', source_url: '', enabled: true, load_order: 0 },
      { id: 'c', name: 'C', version: '', source_url: 'https://x/c.zip', enabled: false, load_order: 1 },
    ])
    expect(sorted.map((row) => row.id)).toEqual(['b'])
  })

  it('pickModFilename prefers URL basename', () => {
    expect(
      pickModFilename('https://cdn.example/mod-pack.zip', {
        id: 'm1',
        name: 'Pack',
        version: '',
        source_url: 'https://cdn.example/mod-pack.zip',
        enabled: true,
        load_order: 0,
      }),
    ).toBe('mod-pack.zip')
  })

  it('fetchGameMods parses API rows', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        enabled: true,
        mods: [{ id: 'm1', name: 'HD', source_url: 'https://x/hd.zip', enabled: true, load_order: 1 }],
      }),
    })) as unknown as typeof fetch

    const result = await fetchGameMods(
      { getBaseUrl: () => 'https://gt.example', getToken: () => 'gt_x_y' } as never,
      'game-1',
      { fetchImpl },
    )
    expect(result.mods).toHaveLength(1)
    expect(result.mods[0].source_url).toBe('https://x/hd.zip')
  })

  it('fetchModsSummaryGameUuids collects games with enabled mods', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        enabled: true,
        games: [{ game_uuid: 'g1', enabled_count: 2 }, { game_uuid: 'g2', enabled_count: 0 }],
      }),
    })) as unknown as typeof fetch

    const uuids = await fetchModsSummaryGameUuids(
      { getBaseUrl: () => 'https://gt.example', getToken: () => 'gt_x_y' } as never,
      { fetchImpl },
    )
    expect(uuids.gameUuids.has('g1')).toBe(true)
    expect(uuids.gameUuids.has('g2')).toBe(false)
    expect(uuids.trackingEnabled).toBe(true)
  })

  it('stageModFromUrl writes under app_data/mods via write_file_bytes', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'get_app_subdir') {
        return '/appdata/mods'
      }
      return undefined
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('PK').buffer,
    })) as unknown as typeof fetch

    const result = await stageModFromUrl({
      gameUuid: 'game-42',
      mod: {
        id: 'hd',
        name: 'HD',
        version: '1',
        source_url: 'https://cdn.example/hd.zip',
        enabled: true,
        load_order: 0,
      },
      fetchImpl,
    })

    expect(result).toEqual({ ok: true, path: '/appdata/mods/game-42/hd/hd.zip' })
    expect(invoke).toHaveBeenCalledWith('write_file_bytes', {
      path: '/appdata/mods/game-42/hd/hd.zip',
      bytes: expect.any(Array),
    })
  })

  it('kickoffApplyModPack stages and applies each enabled mod', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'get_app_subdir') {
        return '/appdata/mods'
      }
      if (command === 'apply_staged_mod') {
        return { applied: 3 }
      }
      return undefined
    })

    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/mods')) {
        return {
          ok: true,
          json: async () => ({
            enabled: true,
            mods: [
              {
                id: 'm1',
                name: 'One',
                source_url: 'https://cdn.example/one.zip',
                enabled: true,
                load_order: 0,
              },
            ],
          }),
        }
      }
      return {
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('PK').buffer,
      }
    }) as unknown as typeof fetch

    const result = await kickoffApplyModPack(
      { getBaseUrl: () => 'https://gt.example', getToken: () => 'gt_x_y' } as never,
      'game-42',
      { fetchImpl },
    )

    expect(result).toEqual({ ok: true, appliedMods: 1, filesApplied: 3 })
    expect(invoke).toHaveBeenCalledWith('apply_staged_mod', {
      sourcePath: '/appdata/mods/game-42/m1/one.zip',
      installRoot: 'C:\\GameTheca\\installs\\game-42',
    })
  })

  it('modApplyBlockedReason explains offline and install requirements', () => {
    expect(
      modApplyBlockedReason({
        connectionOnline: false,
        modsTrackingEnabled: true,
        hasEnabledMods: true,
        installed: true,
      }),
    ).toMatch(/offline/i)
    expect(
      modApplyBlockedReason({
        connectionOnline: true,
        modsTrackingEnabled: true,
        hasEnabledMods: true,
        installed: false,
      }),
    ).toMatch(/Install/i)
    expect(
      modApplyBlockedReason({
        connectionOnline: true,
        modsTrackingEnabled: true,
        hasEnabledMods: true,
        installed: true,
      }),
    ).toBeNull()
  })

  it('modApplyUiHint mentions WebRetro limitation', () => {
    expect(modApplyUiHint(false)).toMatch(/WebRetro/i)
    expect(modApplyUiHint(true)).toMatch(/WebRetro/i)
  })
})
