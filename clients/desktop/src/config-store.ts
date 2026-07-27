import { invoke } from '@tauri-apps/api/core'
import { SECURE_STORE_ACCOUNT, type InvokeFn } from './keychain.js'

export interface StoredConfig {
  baseUrl: string
  token: string | null
}

interface RawAppConfig {
  base_url: string
  token?: string | null
}

export interface ConfigStoreDeps {
  invokeFn?: InvokeFn
  isRuntime?: () => boolean
  /** Account used when migrating a plaintext token into the OS store. */
  secureAccount?: string
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Load companion config. Migrates a legacy plaintext `token` from config.json
 * into the OS secure store on first read, then scrubs it from JSON.
 */
export async function loadStoredConfig(deps: ConfigStoreDeps = {}): Promise<StoredConfig> {
  const isRuntime = deps.isRuntime ?? isTauriRuntime
  if (!isRuntime()) {
    return { baseUrl: '', token: null }
  }

  const invokeFn = deps.invokeFn ?? (invoke as InvokeFn)
  const account = deps.secureAccount ?? SECURE_STORE_ACCOUNT
  const raw = await invokeFn<RawAppConfig>('load_config')
  const baseUrl = raw.base_url ?? ''
  let token = raw.token ?? null

  if (token) {
    try {
      await invokeFn('secure_store_set', { account, secret: token })
      await invokeFn('save_config', {
        config: { base_url: baseUrl, token: null },
      })
    } catch {
      // Keep plaintext until the OS store accepts the secret; retry next load.
    }
  }

  return { baseUrl, token }
}

/**
 * Persist non-secret config. API tokens must go through the keychain adapter —
 * this never writes `token` into config.json.
 */
export async function saveStoredConfig(
  config: StoredConfig,
  deps: ConfigStoreDeps = {},
): Promise<void> {
  const isRuntime = deps.isRuntime ?? isTauriRuntime
  if (!isRuntime()) {
    return
  }

  const invokeFn = deps.invokeFn ?? (invoke as InvokeFn)
  await invokeFn('save_config', {
    config: {
      base_url: config.baseUrl,
      token: null,
    },
  })
}
