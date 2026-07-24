import { invoke } from '@tauri-apps/api/core'

import type { AuthStore } from './auth.js'
import type { GamethecaClient } from './api.js'
import { isTauriRuntime } from './config-store.js'
import { downloadGameArchive } from './download.js'
import { extractInstallArchive, getInstallRecord } from './install.js'
import {
  loadInstallsFromDisk,
  saveInstallsToDisk,
} from './install-store.js'
import type { GameLifecycleState, LifecycleRegistry } from './lifecycle.js'

async function removeLocalPath(path: string | undefined | null): Promise<void> {
  if (!path || !isTauriRuntime()) {
    return
  }
  await invoke('remove_path', { path })
}

export async function kickoffUninstall(
  registry: LifecycleRegistry,
  gameUuid: string,
  options: { removeArchive?: boolean } = {},
): Promise<GameLifecycleState> {
  const state = registry.get(gameUuid)
  if (state !== 'downloaded' && state !== 'installed' && state !== 'update_available') {
    throw new Error(`Game ${gameUuid} cannot be uninstalled from state ${state}`)
  }

  const record = await getInstallRecord(gameUuid)
  if (record) {
    await removeLocalPath(record.extractPath)
    if (options.removeArchive ?? true) {
      await removeLocalPath(record.archivePath)
    }

    const installs = await loadInstallsFromDisk()
    delete installs[gameUuid]
    await saveInstallsToDisk(installs)
  }

  return registry.apply(gameUuid, 'uninstall')
}

export async function kickoffUpdate(
  api: GamethecaClient,
  auth: AuthStore,
  registry: LifecycleRegistry,
  gameUuid: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: (progress: { bytesReceived: number; totalBytes: number | null }) => void
  } = {},
): Promise<GameLifecycleState> {
  if (registry.get(gameUuid) !== 'update_available') {
    throw new Error(`Game ${gameUuid} is not in update_available state`)
  }

  const existing = await getInstallRecord(gameUuid)
  if (existing) {
    await removeLocalPath(existing.extractPath)
  }

  const record = await downloadGameArchive(api, auth, gameUuid, options)
  await extractInstallArchive(gameUuid, record)
  return registry.apply(gameUuid, 'update')
}
