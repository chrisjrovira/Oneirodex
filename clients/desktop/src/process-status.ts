import { invoke } from '@tauri-apps/api/core'

import { isTauriRuntime } from './config-store.js'

export async function isProcessRunning(pid: number): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false
  }

  return invoke<boolean>('is_process_running', { pid })
}
