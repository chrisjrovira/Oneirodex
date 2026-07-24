import { invoke } from '@tauri-apps/api/core'

export interface StoredConfig {
  baseUrl: string
  token: string | null
}

interface RawAppConfig {
  base_url: string
  token?: string | null
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function loadStoredConfig(): Promise<StoredConfig> {
  if (!isTauriRuntime()) {
    return { baseUrl: '', token: null }
  }

  const raw = await invoke<RawAppConfig>('load_config')
  return {
    baseUrl: raw.base_url ?? '',
    token: raw.token ?? null,
  }
}

export async function saveStoredConfig(config: StoredConfig): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }

  await invoke('save_config', {
    config: {
      base_url: config.baseUrl,
      token: config.token,
    },
  })
}
