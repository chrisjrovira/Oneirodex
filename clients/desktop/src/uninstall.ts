import { invoke } from '@tauri-apps/api/core'

import type { AuthStore } from './auth.js'
import type { OneirodexClient } from './api.js'
import { isTauriRuntime } from './config-store.js'
import { downloadGameArchive } from './download.js'
import { extractInstallArchive, getInstallRecord } from './install.js'
import {
  loadInstallsFromDisk,
  saveInstallsToDisk,
  type GameInstallRecord,
} from './install-store.js'
import type { GameLifecycleState, LifecycleRegistry } from './lifecycle.js'

async function removeLocalPath(path: string | undefined | null): Promise<void> {
  if (!path || !isTauriRuntime()) {
    return
  }
  await invoke('remove_path', { path })
}

async function renameLocalPath(from: string, to: string): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }
  await invoke('rename_path', { from, to })
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

  const removeArchive = options.removeArchive ?? true
  const record = await getInstallRecord(gameUuid)
  if (record) {
    await removeLocalPath(record.extractPath)
    // Update staging dirs may remain after a failed rename — clean them too.
    if (record.extractPath) {
      await removeLocalPath(`${record.extractPath}.staging`)
    }
    if (removeArchive) {
      await removeLocalPath(record.archivePath)
    }

    const installs = await loadInstallsFromDisk()
    delete installs[gameUuid]
    await saveInstallsToDisk(installs)
  }

  let next = registry.apply(gameUuid, 'uninstall')
  // Default uninstall removes the archive — `downloaded` without files is a dead end.
  if (removeArchive && next === 'downloaded') {
    next = registry.apply(gameUuid, 'uninstall')
  }
  return next
}

export async function kickoffUpdate(
  api: OneirodexClient,
  auth: AuthStore,
  registry: LifecycleRegistry,
  gameUuid: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: (progress: { bytesReceived: number; totalBytes: number | null }) => void
    kind?: 'base' | 'update' | 'extra'
    versionUuid?: string
  } = {},
): Promise<GameLifecycleState> {
  const state = registry.get(gameUuid)
  const applyingPack =
    Boolean(options.versionUuid) || options.kind === 'update' || options.kind === 'extra'
  const needsForcedUpdateState =
    state !== 'update_available' &&
    applyingPack &&
    (state === 'installed' || state === 'downloaded')

  if (state !== 'update_available' && !needsForcedUpdateState) {
    throw new Error(`Game ${gameUuid} is not in update_available state`)
  }

  const existing = await getInstallRecord(gameUuid)
  const record = await downloadGameArchive(api, auth, gameUuid, {
    fetchImpl: options.fetchImpl,
    onProgress: options.onProgress,
    kind: options.kind,
    versionUuid: options.versionUuid,
  })

  const finalExtract = record.extractPath
  const stagingExtract = `${finalExtract}.staging`

  if (isTauriRuntime()) {
    const stagingRecord: GameInstallRecord = {
      ...record,
      extractPath: stagingExtract,
    }
    const extracted = await extractInstallArchive(gameUuid, stagingRecord)
    if (existing?.extractPath && existing.extractPath !== stagingExtract) {
      await removeLocalPath(existing.extractPath)
    }
    if (finalExtract !== stagingExtract) {
      await removeLocalPath(finalExtract)
      await renameLocalPath(stagingExtract, finalExtract)
    }
    const remappedExe =
      extracted.exePath && extracted.exePath.startsWith(stagingExtract)
        ? `${finalExtract}${extracted.exePath.slice(stagingExtract.length)}`
        : extracted.exePath ?? null
    await saveInstallsToDisk({
      ...(await loadInstallsFromDisk()),
      [gameUuid]: {
        archivePath: record.archivePath,
        extractPath: finalExtract,
        exePath: remappedExe,
      },
    })
  } else {
    await extractInstallArchive(gameUuid, record)
  }

  if (needsForcedUpdateState) {
    registry.signalUpdateAvailable(gameUuid)
  }
  return registry.apply(gameUuid, 'update')
}
