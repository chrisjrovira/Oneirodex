/** Join base URL and path segment without duplicate slashes. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

/** Server initiate endpoint for desktop/API clients. */
export function buildInitiateDownloadPath(gameUuid: string): string {
  return `/api/downloads/games/${gameUuid}`
}

/** Web-compatible streaming path after initiate returns download_id. */
export function buildDownloadStreamPath(downloadId: number): string {
  return `/download_zip/${downloadId}`
}

/** Local archive filename under the app-data downloads directory. */
export function buildLocalArchiveName(gameUuid: string): string {
  return `${gameUuid}.zip`
}

/** Local extract directory name under the app-data installs directory. */
export function buildLocalInstallDirName(gameUuid: string): string {
  return gameUuid
}
