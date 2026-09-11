import type { Requester } from './client.js'

// Art Studio: the painted-cover generator (title + system → cover pack).

export interface ArtStudioPreviewRequest {
  title: string
  system?: string
  width?: number
  height?: number
  headline?: string
  subtitle?: string
  title_scale?: number
  [key: string]: unknown
}

export interface ArtStudioPreviewResponse {
  preview?: string
  artistic?: boolean
  [key: string]: unknown
}

export interface ArtStudioGenerateRequest {
  title: string
  system?: string
  format?: string
  headline?: string
  subtitle?: string
  title_scale?: number
  [key: string]: unknown
}

export interface ArtStudioGenerateResponse {
  pack_id?: string
  preview_url?: string
  files?: unknown[]
  [key: string]: unknown
}

export interface ArtStudioApplyRequest {
  pack_id: string
  mode: 'game' | 'fallback' | string
  game_uuid?: string
  [key: string]: unknown
}

export interface ArtStudioApplyResponse {
  game_uuid?: string
  [key: string]: unknown
}

export interface ArtStudioBatchGenerateRequest {
  game_uuids: string[]
  missing_cover?: boolean
  system?: string
  [key: string]: unknown
}

export interface ArtStudioBatchResult {
  applied?: number
  failed?: number
  results?: unknown[]
  errors?: unknown[]
  [key: string]: unknown
}

export interface StockGenerateRequest {
  ids: string[]
  [key: string]: unknown
}

export interface SystemMarksGenerateRequest {
  theme?: string
  platforms?: string[]
  [key: string]: unknown
}

export interface SystemMarksGenerateResponse {
  generated?: number
  skipped?: number
  errors?: unknown[]
  [key: string]: unknown
}

// Provider covers: multi-provider search/apply for one title, plus the
// batch variants ImagesPage drives from the missing-cover queue.

export interface CoversSearchRequest {
  game_uuid?: string
  title?: string
  [key: string]: unknown
}

export interface CoversApplyRequest {
  game_uuid: string
  [key: string]: unknown
}

export interface CoversBatchRequest {
  policy?: string
  missing_cover?: boolean
  limit_games?: number
  library_uuid?: string
  platform?: string
  service?: string
  [key: string]: unknown
}

export interface CoversBatchResult {
  applied?: number
  failed?: number
  results?: unknown[]
  games?: unknown[]
  [key: string]: unknown
}

export interface ArtworkGenerateRequest {
  game_uuid: string
  image_type?: string
  [key: string]: unknown
}

export interface DownloadImagesRequest {
  batch_size?: number
  retry_failed?: boolean
  image_ids?: string[]
  [key: string]: unknown
}

export type DownloadImagesResult = Record<string, unknown>

export function createAdminArtApi(request: Requester) {
  return {
    /** Live cover preview at one variant size (`POST /admin/api/art-studio/preview`). */
    preview(body: ArtStudioPreviewRequest): Promise<ArtStudioPreviewResponse> {
      return request<ArtStudioPreviewResponse>('/admin/api/art-studio/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Render a full cover pack (`POST /admin/api/art-studio/generate`). */
    generate(body: ArtStudioGenerateRequest): Promise<ArtStudioGenerateResponse> {
      return request<ArtStudioGenerateResponse>('/admin/api/art-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * Apply a generated pack to a game or as the library fallback
     * (`POST /admin/api/art-studio/apply`).
     */
    apply(body: ArtStudioApplyRequest): Promise<ArtStudioApplyResponse> {
      return request<ArtStudioApplyResponse>('/admin/api/art-studio/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * Generate + apply placeholder covers for several no-cover titles at once
     * (`POST /admin/api/art-studio/batch-generate`).
     */
    batchGenerate(body: ArtStudioBatchGenerateRequest): Promise<ArtStudioBatchResult> {
      return request<ArtStudioBatchResult>('/admin/api/art-studio/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Platform / era / stock motif catalog (`GET /admin/api/art-studio/stock`). */
    getStockCatalog(signal?: AbortSignal): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/art-studio/stock', { signal })
    },

    /** Render one or more stock packs (`POST /admin/api/art-studio/stock/generate`). */
    generateStock(body: StockGenerateRequest): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/art-studio/stock/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Per-platform system-mark theme progress (`GET /admin/api/art-studio/system-marks`). */
    getSystemMarks(signal?: AbortSignal): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/art-studio/system-marks', { signal })
    },

    /** Generate a theme's remaining system marks (`POST .../system-marks/generate`). */
    generateSystemMarks(body: SystemMarksGenerateRequest): Promise<SystemMarksGenerateResponse> {
      return request<SystemMarksGenerateResponse>('/admin/api/art-studio/system-marks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * One-off lab render for a theme/platform pair
     * (`GET /admin/api/art-studio/system-marks/lab`).
     */
    getSystemMarksLab(
      theme: string,
      platform: string,
      signal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
      const qs = `?theme=${encodeURIComponent(theme)}&platform=${encodeURIComponent(platform)}`
      return request<Record<string, unknown>>(`/admin/api/art-studio/system-marks/lab${qs}`, {
        signal,
      })
    },

    /** Multi-provider cover search for one title (`POST /admin/api/covers/search`). */
    searchCovers(body: CoversSearchRequest): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/covers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Apply one provider cover result (`POST /admin/api/covers/apply`). */
    applyCover(body: CoversApplyRequest): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/covers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Provider cover search across several missing-cover titles (`POST .../covers/batch/search`). */
    batchSearchCovers(body: CoversBatchRequest): Promise<CoversBatchResult> {
      return request<CoversBatchResult>('/admin/api/covers/batch/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Auto-pick + apply covers across several titles (`POST /admin/api/covers/batch/apply`). */
    batchApplyCovers(body: CoversBatchRequest): Promise<CoversBatchResult> {
      return request<CoversBatchResult>('/admin/api/covers/batch/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * AI-generate one artwork image (`POST /admin/api/artwork/generate`).
     * Off unless `ENABLE_AI_ARTWORK` + `AI_ARTWORK_URL` are configured.
     */
    generateArtwork(body: ArtworkGenerateRequest): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>('/admin/api/artwork/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Queue/retry bulk image downloads (`POST /admin/api/download_images`). */
    downloadImages(body: DownloadImagesRequest = {}): Promise<DownloadImagesResult> {
      return request<DownloadImagesResult>('/admin/api/download_images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
  }
}

export type AdminArtApi = ReturnType<typeof createAdminArtApi>
