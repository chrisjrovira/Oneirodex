import type { Requester } from './client.js'

/** Loose row shape — the SPA reads many optional fields; keep the known ones typed. */
export interface LibrarySummary {
  uuid: string
  name: string
  platform?: string | null
  game_count?: number
  [key: string]: unknown
}

export interface GetLibrariesResponse {
  libraries?: LibrarySummary[]
  [key: string]: unknown
}

export interface LibraryWatchState {
  watch_enabled?: boolean
  [key: string]: unknown
}

/** Shared by every scan-start route: `'queue'` waits its turn, `'force'` runs alongside. */
export interface ScanQueueFields {
  queue_policy?: 'queue' | 'force'
  force_parallel?: boolean
}

export interface StartLibraryScanRequest extends ScanQueueFields {
  library_uuid: string
  /** Omitted falls back to the library's `last_scan_folder`. */
  folder?: string
  scan_mode?: 'files' | 'folders'
  remove_missing?: boolean
  download_missing_images?: boolean
  [key: string]: unknown
}

export interface ScanStartResponse {
  status?: string
  job_id?: string | number
  message?: string
  /** Queue position when `queue_policy` deferred the job behind another. */
  position?: number
  [key: string]: unknown
}

export interface BatchLibraryScanRequest extends ScanQueueFields {
  library_uuids: string[]
}

export interface BatchLibraryEditRequest {
  library_uuids: string[]
  group_name?: string
  [key: string]: unknown
}

export interface BatchLibraryResult {
  message?: string
  [key: string]: unknown
}

export type RefreshAllLibrariesRequest = ScanQueueFields

/** One row of `GET /api/scan_jobs_status`. */
export interface ScanJobRow {
  id: string | number
  library_uuid?: string
  library_name?: string
  status?: string
  scan_folder?: string
  [key: string]: unknown
}

export function createLibraryApi(request: Requester) {
  return {
    /** All libraries visible to the caller (`GET /api/get_libraries`). */
    list(signal?: AbortSignal): Promise<GetLibrariesResponse> {
      return request<GetLibrariesResponse>('/api/get_libraries', { signal })
    },

    /** One library by uuid (`GET /api/library/{uuid}`). */
    get(libraryUuid: string, signal?: AbortSignal): Promise<LibrarySummary> {
      return request<LibrarySummary>(`/api/library/${encodeURIComponent(libraryUuid)}`, { signal })
    },

    /** Read the per-library freshness-watch flag (`GET /api/library/{uuid}/watch`). */
    getWatch(libraryUuid: string): Promise<LibraryWatchState> {
      return request<LibraryWatchState>(`/api/library/${encodeURIComponent(libraryUuid)}/watch`)
    },

    /**
     * Set the per-library freshness-watch flag (`PUT /api/library/{uuid}/watch`).
     * `null` means "follow the global default"; `false` opts out even when the
     * env master switch is on. Librarian or admin only.
     */
    setWatch(libraryUuid: string, enabled: boolean | null): Promise<LibraryWatchState> {
      return request<LibraryWatchState>(`/api/library/${encodeURIComponent(libraryUuid)}/watch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch_enabled: enabled }),
      })
    },

    /** Persist a new library display order (`POST /api/reorder_libraries`). */
    reorder(orderedUuids: string[]): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>('/api/reorder_libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedUuids }),
      })
    },

    /**
     * Start (or queue) a scan for one library (`POST /api/admin/libraries/scan`).
     * A `409`-shaped rejection (`isAlreadyRunningReject` in the admin SPA) means
     * a scan is already running — the caller re-posts with an explicit
     * `queue_policy` once the operator picks Queue or Force.
     */
    startScan(body: StartLibraryScanRequest): Promise<ScanStartResponse> {
      return request<ScanStartResponse>('/api/admin/libraries/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Queue a scan across several libraries at once (`POST .../libraries/batch/scan`). */
    batchScan(body: BatchLibraryScanRequest): Promise<BatchLibraryResult> {
      return request<BatchLibraryResult>('/api/admin/libraries/batch/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Bulk-edit several libraries, e.g. a group rename (`POST .../libraries/batch/edit`). */
    batchEdit(body: BatchLibraryEditRequest): Promise<BatchLibraryResult> {
      return request<BatchLibraryResult>('/api/admin/libraries/batch/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Queue/refresh every library (`POST /api/admin/libraries/refresh_all`). */
    refreshAll(body: RefreshAllLibrariesRequest = {}): Promise<ScanStartResponse> {
      return request<ScanStartResponse>('/api/admin/libraries/refresh_all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Active/queued/finished scan jobs (`GET /api/scan_jobs_status`). */
    getScanJobsStatus(signal?: AbortSignal): Promise<ScanJobRow[]> {
      return request<ScanJobRow[]>('/api/scan_jobs_status', { signal })
    },
  }
}

export type LibraryApi = ReturnType<typeof createLibraryApi>
