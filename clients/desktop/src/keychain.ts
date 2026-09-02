import { invoke } from '@tauri-apps/api/core'
import type { KeychainAdapter } from './auth.js'

/** OS credential account for the Oneirodex API token. */
export const SECURE_STORE_ACCOUNT = 'api_token'

export type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

export interface KeychainAdapterDeps {
  invokeFn?: InvokeFn
  isRuntime?: () => boolean
  account?: string
}

function defaultIsRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * OS secure store adapter (Windows Credential Manager / macOS Keychain / Linux Secret Service)
 * via Tauri `secure_store_*` commands.
 */
export function createKeychainAdapter(deps: KeychainAdapterDeps = {}): KeychainAdapter {
  const invokeFn = deps.invokeFn ?? (invoke as InvokeFn)
  const isRuntime = deps.isRuntime ?? defaultIsRuntime
  const account = deps.account ?? SECURE_STORE_ACCOUNT

  return {
    async load(): Promise<string | null> {
      if (!isRuntime()) {
        return null
      }
      const secret = await invokeFn<string | null>('secure_store_get', { account })
      return secret ?? null
    },

    async save(token: string): Promise<void> {
      if (!isRuntime()) {
        return
      }
      await invokeFn('secure_store_set', { account, secret: token })
    },

    async clear(): Promise<void> {
      if (!isRuntime()) {
        return
      }
      await invokeFn('secure_store_delete', { account })
    },
  }
}

export const keychainAdapter: KeychainAdapter = createKeychainAdapter()
