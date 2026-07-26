import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createAuthStore } from './auth.js'
import { kickoffDownload, resolveArchivePath } from './download.js'
import { postClientHeartbeat } from './heartbeat.js'
import { createLifecycleRegistry } from './lifecycle.js'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('./config-store.js', () => ({
  isTauriRuntime: () => true,
}))

import { invoke } from '@tauri-apps/api/core'

describe('download kickoff helper', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(invoke).mockImplementation(async (command: string, args?: { subdir?: string }) => {
      if (command === 'get_app_subdir') {
        return args?.subdir === 'installs' ? '/appdata/installs' : '/appdata/downloads'
      }
      if (command === 'load_installs') {
        return { installs: {} }
      }
      return undefined
    })
  })

  it('marks a game downloaded after a successful download pipeline', async () => {
    const auth = createAuthStore()
    auth.setBaseUrl('https://example.com')
    auth.setToken('gt_prefix_secret')

    const registry = createLifecycleRegistry()
    const initiate = vi.fn().mockResolvedValue({
      download_id: 7,
      status: 'available',
      stream_url: '/download_zip/7',
    })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      body: null,
    })

    const api = {
      downloads: { initiateGameDownload: initiate },
    }

    const next = await kickoffDownload(api as never, auth, registry, 'game-42', { fetchImpl })

    expect(initiate).toHaveBeenCalledWith('game-42', {
      kind: undefined,
      versionUuid: undefined,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/download_zip/7',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer gt_prefix_secret',
        }),
      }),
    )
    expect(invoke).toHaveBeenCalledWith('write_file_bytes', {
      path: resolveArchivePath('/appdata/downloads', 'game-42'),
      bytes: expect.any(Uint8Array),
    })
    expect(next).toBe('downloaded')
    expect(registry.get('game-42')).toBe('downloaded')
  })

  it('passes version options to initiate download', async () => {
    const auth = createAuthStore()
    auth.setBaseUrl('https://example.com')
    auth.setToken('gt_prefix_secret')

    const registry = createLifecycleRegistry()
    const initiate = vi.fn().mockResolvedValue({
      download_id: 8,
      status: 'available',
      stream_url: '/download_zip/8',
    })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '2' }),
      arrayBuffer: async () => new Uint8Array([9, 9]).buffer,
      body: null,
    })
    const api = {
      downloads: { initiateGameDownload: initiate },
    }

    await kickoffDownload(api as never, auth, registry, 'game-99', {
      fetchImpl,
      kind: 'update',
      versionUuid: 'upd-1',
    })

    expect(initiate).toHaveBeenCalledWith('game-99', {
      kind: 'update',
      versionUuid: 'upd-1',
    })
  })

  it('leaves lifecycle unchanged when download fails', async () => {
    const auth = createAuthStore()
    auth.setBaseUrl('https://example.com')
    auth.setToken('gt_prefix_secret')

    const registry = createLifecycleRegistry()
    const api = {
      downloads: {
        initiateGameDownload: vi.fn().mockRejectedValue(new Error('Missing scope')),
      },
    }

    await expect(kickoffDownload(api as never, auth, registry, 'game-42')).rejects.toThrow(
      'Missing scope',
    )
    expect(registry.get('game-42')).toBe('not_downloaded')
  })
})

describe('client heartbeat helper', () => {
  it('posts heartbeat payload with bearer auth', async () => {
    const auth = createAuthStore()
    auth.setBaseUrl('https://example.com')
    auth.setToken('gt_prefix_secret')

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commands: [] }),
    })
    await postClientHeartbeat(auth, {
      deviceId: 'device-1',
      deviceName: 'Test Desktop',
      clientVersion: '0.0.1',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/api/client/heartbeat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer gt_prefix_secret',
        }),
      }),
    )
  })
})
