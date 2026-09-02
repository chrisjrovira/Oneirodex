import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStoredConfig, saveStoredConfig } from './config-store.js'
import { SECURE_STORE_ACCOUNT } from './keychain.js'
import type { InvokeFn } from './keychain.js'

describe('config-store secure migration', () => {
  let invokeFn: ReturnType<typeof vi.fn<InvokeFn>>
  let config: { base_url: string; token: string | null }
  let vault: Map<string, string>

  beforeEach(() => {
    config = { base_url: '', token: null }
    vault = new Map()
    invokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'load_config') {
        return { ...config }
      }
      if (cmd === 'save_config') {
        const next = args?.config as { base_url: string; token: string | null }
        config = { base_url: next.base_url, token: next.token ?? null }
        return undefined
      }
      if (cmd === 'secure_store_get') {
        return vault.get(String(args?.account ?? '')) ?? null
      }
      if (cmd === 'secure_store_set') {
        vault.set(String(args?.account ?? ''), String(args?.secret ?? ''))
        return undefined
      }
      if (cmd === 'secure_store_delete') {
        vault.delete(String(args?.account ?? ''))
        return undefined
      }
      throw new Error(`unexpected command ${cmd}`)
    }) as ReturnType<typeof vi.fn<InvokeFn>>
  })

  it('migrates plaintext token into secure store and scrubs JSON', async () => {
    config = {
      base_url: 'https://oneirodex.local',
      token: 'gt_ab12cd34_secretpart',
    }

    const stored = await loadStoredConfig({
      invokeFn: invokeFn as InvokeFn,
      isRuntime: () => true,
    })

    expect(stored).toEqual({
      baseUrl: 'https://oneirodex.local',
      token: 'gt_ab12cd34_secretpart',
    })
    expect(vault.get(SECURE_STORE_ACCOUNT)).toBe('gt_ab12cd34_secretpart')
    expect(config.token).toBeNull()
    expect(invokeFn).toHaveBeenCalledWith('secure_store_set', {
      account: SECURE_STORE_ACCOUNT,
      secret: 'gt_ab12cd34_secretpart',
    })
    expect(invokeFn).toHaveBeenCalledWith('save_config', {
      config: { base_url: 'https://oneirodex.local', token: null },
    })
  })

  it('leaves plaintext token when secure store write fails', async () => {
    config = {
      base_url: 'https://oneirodex.local',
      token: 'gt_ab12cd34_secretpart',
    }
    invokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'load_config') {
        return { ...config }
      }
      if (cmd === 'secure_store_set') {
        throw new Error('credential manager unavailable')
      }
      if (cmd === 'save_config') {
        const next = args?.config as { base_url: string; token: string | null }
        config = { base_url: next.base_url, token: next.token ?? null }
        return undefined
      }
      throw new Error(`unexpected command ${cmd}`)
    }) as ReturnType<typeof vi.fn<InvokeFn>>

    const stored = await loadStoredConfig({
      invokeFn: invokeFn as InvokeFn,
      isRuntime: () => true,
    })

    expect(stored.token).toBe('gt_ab12cd34_secretpart')
    expect(config.token).toBe('gt_ab12cd34_secretpart')
  })

  it('never writes token when saving config', async () => {
    await saveStoredConfig(
      { baseUrl: 'https://oneirodex.local', token: 'gt_ab12cd34_secretpart' },
      { invokeFn: invokeFn as InvokeFn, isRuntime: () => true },
    )

    expect(config).toEqual({
      base_url: 'https://oneirodex.local',
      token: null,
    })
    expect(invokeFn).toHaveBeenCalledWith('save_config', {
      config: { base_url: 'https://oneirodex.local', token: null },
    })
  })
})
