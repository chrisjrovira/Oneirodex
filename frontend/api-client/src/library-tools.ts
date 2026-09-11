import type { Requester } from './client.js'

/** Body for `proposeLeafLibraries` — a filesystem root to scan for leaf libraries. */
export interface ProposeLeafLibrariesRequest {
  root: string
  [key: string]: unknown
}

/** One preview-only candidate row (propose or import preview). Never creates. */
export interface LeafLibraryCandidate {
  path: string
  suggested_name?: string
  platform?: string
  scan_mode?: 'files' | 'folders'
  scan_depth?: number
  reason?: string
  source_index?: number
  [key: string]: unknown
}

export interface ProposeLeafLibrariesResponse {
  status?: string
  root?: string
  /** Always `false` for a well-behaved server — this route must never create. */
  auto_create?: boolean
  count?: number
  candidates?: LeafLibraryCandidate[]
  [key: string]: unknown
}

/** One rejected row from an import preview (e.g. a mega-lib parent path). */
export interface ImportLeafLibrariesPreviewError {
  index?: number | null
  path?: string | null
  code?: string
  message?: string
  [key: string]: unknown
}

export interface ImportLeafLibrariesPreviewResponse {
  status?: string
  auto_create?: boolean
  count?: number
  error_count?: number
  create_hint?: string
  candidates?: LeafLibraryCandidate[]
  errors?: ImportLeafLibrariesPreviewError[]
  [key: string]: unknown
}

export function createLibraryToolsApi(request: Requester) {
  return {
    /**
     * Preview leaf libraries under a root — candidates only, never creates
     * (`POST /api/library_tools/propose_leaf_libraries`).
     */
    proposeLeafLibraries(body: ProposeLeafLibrariesRequest): Promise<ProposeLeafLibrariesResponse> {
      return request<ProposeLeafLibrariesResponse>('/api/library_tools/propose_leaf_libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * Preview a CSV/JSON leaf-library import — candidates only, never creates
     * (`POST /api/library_tools/import_leaf_libraries/preview`).
     *
     * `body` is either the parsed JSON payload for a pasted array/object, or a
     * `FormData` carrying a `csv` field (pasted CSV) or an uploaded `file`
     * (`format` set to `'csv'` for a `.csv` upload) — the three input modes
     * the admin SPA's import panel offers. A `FormData` body skips the JSON
     * `Content-Type` header so the browser sets its own multipart boundary.
     */
    importLeafLibrariesPreview(
      body: unknown | FormData,
    ): Promise<ImportLeafLibrariesPreviewResponse> {
      const isForm = body instanceof FormData
      return request<ImportLeafLibrariesPreviewResponse>(
        '/api/library_tools/import_leaf_libraries/preview',
        {
          method: 'POST',
          ...(isForm ? {} : { headers: { 'Content-Type': 'application/json' } }),
          body: isForm ? body : JSON.stringify(body),
        },
      )
    },
  }
}

export type LibraryToolsApi = ReturnType<typeof createLibraryToolsApi>
