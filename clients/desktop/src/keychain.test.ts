import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthStore } from './auth.js'
import { createKeychainAdapter, SECURE_STORE_ACCOUNT } from './keychain.js'
import type { InvokeFn } from './keychain.js'

describe('createKeychainAdapter', () => {
  let invokeFn: ReturnType<typeof vi.fn<InvokeFn>>
  let vault: Map<string, string>

  beforeEach(() => {
    vault = new Map()
    invokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      const account = String(args?.account ?? '')
      if (cmd === 'secure_store_get') {
        return vault.get(account) ?? null
      }
      if (cmd === 'secure_store_set') {
        vault.set(account, String(args?.secret ?? ''))
        return undefined
      }
      if (cmd === 'secure_store_delete') {
        vault.delete(account)
        return undefined
      }
      throw new Error(`unexpected command ${cmd}`)
    }) as ReturnType<typeof vi.fn<InvokeFn>>
  })

  it('loads, saves, and clears via secure_store commands', async () => {
    const keychain = createKeychainAdapter({
      invokeFn: invokeFn as InvokeFn,
      isRuntime: () => true,
    })

    expect(await keychain.load()).toBeNull()

    await keychain.save('gt_ab12cd34_secretpart')
    expect(invokeFn).toHaveBeenCalledWith('secure_store_set', {
      account: SECURE_STORE_ACCOUNT,
      secret: 'gt_ab12cd34_secretpart',
    })
    expect(await keychain.load()).toBe('gt_ab12cd34_secretpart')

    await keychain.clear()
    expect(invokeFn).toHaveBeenCalledWith('secure_store_delete', {
      account: SECURE_STORE_ACCOUNT,
    })
    expect(await keychain.load()).toBeNull()
  })

  it('is a no-op outside Tauri runtime', async () => {
    const keychain = createKeychainAdapter({
      invokeFn: invokeFn as InvokeFn,
      isRuntime: () => false,
    })

    await keychain.save('gt_ab12cd34_secretpart')
    expect(await keychain.load()).toBeNull()
    await keychain.clear()
    expect(invokeFn).not.toHaveBeenCalled()
  })

  it('hydrates and persists through AuthStore', async () => {
    const keychain = createKeychainAdapter({
      invokeFn: invokeFn as InvokeFn,
      isRuntime: () => true,
    })
    await keychain.save('gt_ab12cd34_secretpart')

    const auth = createAuthStore({ baseUrl: 'https://oneirodex.local' })
    await auth.hydrateFromKeychain(keychain)
    expect(auth.getToken()).toBe('gt_ab12cd34_secretpart')

    auth.setToken('gt_newtoken1_secretpart')
    await auth.persistToKeychain(keychain)
    expect(vault.get(SECURE_STORE_ACCOUNT)).toBe('gt_newtoken1_secretpart')

    auth.setToken(null)
    await auth.persistToKeychain(keychain)
    expect(vault.has(SECURE_STORE_ACCOUNT)).toBe(false)
  })
})
