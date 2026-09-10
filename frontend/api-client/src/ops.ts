import type { Requester } from './client.js'

/**
 * `GET /admin/api/ops/summary` — the operations snapshot behind the ops-glance
 * SPA and the admin Ops page (`oneirodex/utils/ops_summary.py`
 * `build_ops_summary`).
 *
 * Every section is nullable: the backend swaps a section that failed to collect
 * for `null` plus a `<section>_error` string and never fails the poll. Shapes
 * stay loose (ADR 0005) until `docs/openapi/openapi.json` covers this route.
 */
export interface OpsSummaryResponse {
  as_of?: string
  host?: Record<string, unknown> | null
  network?: Record<string, unknown> | null
  issues?: {
    overall?: 'good' | 'warn' | 'bad' | string
    items?: Array<{
      id: string | number
      severity: string
      message: string
      href?: string | null
    }>
    [key: string]: unknown
  } | null
  scans?: {
    active_count?: number
    jobs?: Array<Record<string, unknown>>
  } | null
  library?: Record<string, unknown> | null
  recent_errors?: Array<Record<string, unknown>> | null
  [key: string]: unknown
}

export interface OpsSummaryOptions {
  signal?: AbortSignal
}

export function createOpsApi(request: Requester) {
  return {
    /** The operations snapshot (`GET /admin/api/ops/summary`). */
    getSummary(options: OpsSummaryOptions = {}): Promise<OpsSummaryResponse> {
      return request<OpsSummaryResponse>('/admin/api/ops/summary', { signal: options.signal })
    },
  }
}

export type OpsApi = ReturnType<typeof createOpsApi>
