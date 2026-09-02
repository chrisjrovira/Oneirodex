import { invoke } from '@tauri-apps/api/core'

import type { AuthStore } from './auth.js'
import type { OneirodexClient } from './api.js'
import { isTauriRuntime } from './config-store.js'
import {
  loadInstallsFromDisk,
  saveInstallsToDisk,
  type GameInstallRecord,
} from './install-store.js'
import type { GameLifecycleState, LifecycleRegistry } from './lifecycle.js'
import {
  buildDownloadStreamPath,
  buildLocalArchiveName,
  buildLocalInstallDirName,
  joinUrl,
} from './paths.js'

export interface DownloadProgress {
  bytesReceived: number
  totalBytes: number | null
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void

interface InitiateDownloadResponse {
  download_id: number
  status: string
  stream_url: string
}

async function getDownloadsDir(): Promise<string> {
  if (!isTauriRuntime()) {
    return '/tmp/oneirodex/downloads'
  }
  return invoke<string>('get_app_subdir', { subdir: 'downloads' })
}

export async function getInstallsDir(): Promise<string> {
  if (!isTauriRuntime()) {
    return '/tmp/oneirodex/installs'
  }
  return invoke<string>('get_app_subdir', { subdir: 'installs' })
}

export function resolveArchivePath(downloadsDir: string, gameUuid: string): string {
  return `${downloadsDir.replace(/[/\\]+$/, '')}/${buildLocalArchiveName(gameUuid)}`
}

export function resolveExtractPath(installsDir: string, gameUuid: string): string {
  return `${installsDir.replace(/[/\\]+$/, '')}/${buildLocalInstallDirName(gameUuid)}`
}

export async function initiateDownloadRequest(
  api: OneirodexClient,
  gameUuid: string,
  options: { kind?: 'base' | 'update' | 'extra'; versionUuid?: string } = {},
): Promise<InitiateDownloadResponse> {
  return api.downloads.initiateGameDownload(gameUuid, options)
}

export async function fetchDownloadStream(
  auth: AuthStore,
  streamPath: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: DownloadProgressCallback
  } = {},
): Promise<ArrayBuffer> {
  const authHeader = auth.authorizationHeader()
  if (!authHeader) {
    throw new Error('Not authenticated')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(joinUrl(auth.getBaseUrl(), streamPath), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Download failed with HTTP ${response.status}`)
  }

  const totalHeader = response.headers.get('content-length')
  const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : null
  const body = response.body

  if (!body || !options.onProgress) {
    return response.arrayBuffer()
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let bytesReceived = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      chunks.push(value)
      bytesReceived += value.byteLength
      options.onProgress({ bytesReceived, totalBytes })
    }
  }

  const merged = new Uint8Array(bytesReceived)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

/** Stream a download directly to disk (avoids buffering the full zip in RAM). */
export async function streamDownloadToFile(
  auth: AuthStore,
  streamPath: string,
  archivePath: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: DownloadProgressCallback
  } = {},
): Promise<void> {
  const authHeader = auth.authorizationHeader()
  if (!authHeader) {
    throw new Error('Not authenticated')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(joinUrl(auth.getBaseUrl(), streamPath), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Download failed with HTTP ${response.status}`)
  }

  const totalHeader = response.headers.get('content-length')
  const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : null
  const body = response.body

  if (!isTauriRuntime()) {
    return
  }

  // Truncate / create destination.
  await invoke('write_file_bytes', { path: archivePath, bytes: new Uint8Array(0) })

  if (!body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > 0) {
      await invoke('append_file_bytes', { path: archivePath, bytes })
    }
    options.onProgress?.({ bytesReceived: bytes.byteLength, totalBytes })
    return
  }

  const reader = body.getReader()
  let bytesReceived = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      await invoke('append_file_bytes', { path: archivePath, bytes: value })
      bytesReceived += value.byteLength
      options.onProgress?.({ bytesReceived, totalBytes })
    }
  }
}

export async function writeDownloadArchive(archivePath: string, bytes: ArrayBuffer): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }
  await invoke('write_file_bytes', {
    path: archivePath,
    bytes: new Uint8Array(bytes),
  })
}

export async function persistInstallRecord(
  gameUuid: string,
  record: GameInstallRecord,
): Promise<void> {
  const installs = await loadInstallsFromDisk()
  installs[gameUuid] = record
  await saveInstallsToDisk(installs)
}

export async function downloadGameArchive(
  api: OneirodexClient,
  auth: AuthStore,
  gameUuid: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: DownloadProgressCallback
    kind?: 'base' | 'update' | 'extra'
    versionUuid?: string
  } = {},
): Promise<GameInstallRecord> {
  const initiated = await initiateDownloadRequest(api, gameUuid, {
    kind: options.kind,
    versionUuid: options.versionUuid,
  })
  const streamPath = initiated.stream_url || buildDownloadStreamPath(initiated.download_id)

  const downloadsDir = await getDownloadsDir()
  const archivePath = resolveArchivePath(downloadsDir, gameUuid)

  if (isTauriRuntime()) {
    await streamDownloadToFile(auth, streamPath, archivePath, options)
  } else {
    const bytes = await fetchDownloadStream(auth, streamPath, options)
    await writeDownloadArchive(archivePath, bytes)
  }

  const installsDir = await getInstallsDir()
  const record: GameInstallRecord = {
    archivePath,
    extractPath: resolveExtractPath(installsDir, gameUuid),
  }
  await persistInstallRecord(gameUuid, record)
  return record
}

export async function kickoffDownload(
  api: OneirodexClient,
  auth: AuthStore,
  registry: LifecycleRegistry,
  gameUuid: string,
  options: {
    fetchImpl?: typeof fetch
    onProgress?: DownloadProgressCallback
    kind?: 'base' | 'update' | 'extra'
    versionUuid?: string
  } = {},
): Promise<GameLifecycleState> {
  if (registry.get(gameUuid) !== 'not_downloaded') {
    throw new Error(`Game ${gameUuid} is not in not_downloaded state`)
  }

  await downloadGameArchive(api, auth, gameUuid, options)
  return registry.apply(gameUuid, 'download')
}

export async function pickDownloadVersion(
  api: OneirodexClient,
  gameUuid: string,
): Promise<{ kind: 'base' | 'update' | 'extra'; versionUuid?: string }> {
  try {
    const payload = await api.downloads.listGameVersions(gameUuid)
    const versions = payload.versions || []
    if (versions.length <= 1) {
      return { kind: 'base' }
    }
    const lines = versions.map((v, index) => `${index + 1}. [${v.kind}] ${v.label}`).join('\n')
    const answer = window.prompt(`Choose download version number:\n${lines}`, '1')
    if (!answer) {
      return { kind: 'base' }
    }
    const index = Number.parseInt(answer, 10) - 1
    const chosen = versions[index]
    if (!chosen) {
      return { kind: 'base' }
    }
    if (chosen.kind === 'update' || chosen.kind === 'extra') {
      return { kind: chosen.kind, versionUuid: chosen.uuid }
    }
    return { kind: 'base' }
  } catch {
    return { kind: 'base' }
  }
}
