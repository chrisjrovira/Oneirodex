/* Constants, row types and helpers moved out of LibrariesPanel (v11 cycle, H-D.2) — unchanged. */

export const DEFAULT_LIBRARY_IMAGE = '/static/newstyle/default_library.jpg'
export const BATCH_SCAN_URL = '/api/admin/libraries/batch/scan'
export const BATCH_EDIT_URL = '/api/admin/libraries/batch/edit'
export const CATALOG_REFRESH_URL = '/api/licensed-catalog/refresh'
export const CATALOG_REFRESH_FLAG = 'od-libraries-catalog-refresh-v1'

/** GET /api/get_libraries row — loose Backend field map, common fields typed. */
export interface LibraryRow {
  uuid: string
  name: string
  platform?: string
  platform_key?: string
  platform_total?: number
  game_count?: number
  unmatched_count?: number
  group_name?: string
  image_url?: string
  last_scan_folder?: string
  [key: string]: unknown
}

export interface PlatformSummary {
  platform: string
  games: number
  unmatched: number
}

export function libraryThumb(url: unknown): string {
  const src = String(url || '').trim() || DEFAULT_LIBRARY_IMAGE
  return src
}

export function groupLabel(lib: LibraryRow | null | undefined): string {
  return String(lib?.group_name || '').trim()
}

/**
 * Thin-bar “N libraries” control beside account. The menu shows total games
 * with unmatched in parentheses, and a platform filter that drives the table.
 */
