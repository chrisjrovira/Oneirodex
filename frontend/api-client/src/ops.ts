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

/**
 * `GET /admin/api/ops/system` — the admin Ops page's detail panels (System,
 * Database, Logs, Config). Same loose Backend field map as `OpsSummaryResponse`
 * and the same nullable-section convention; panel ids are this payload's keys.
 */
export interface OpsSystemDetail {
  system?: Record<string, unknown> | null
  database?: Record<string, unknown> | null
  logs?: Record<string, unknown> | null
  config?: Record<string, unknown> | null
  [key: string]: unknown
}

/** One row of `GET /admin/api/ops/logs` — shape is a loose Backend log event. */
export interface OpsLogEvent {
  id?: string | number
  timestamp?: string | null
  level?: string
  message?: string
  [key: string]: unknown
}

export interface OpsLogsResponse {
  events?: OpsLogEvent[]
  [key: string]: unknown
}

export interface OpsLogsOptions {
  /** Row cap; omitted sends no `limit` (Backend default applies). */
  limit?: number
  signal?: AbortSignal
}

export function createOpsApi(request: Requester) {
  return {
    /** The operations snapshot (`GET /admin/api/ops/summary`). */
    getSummary(options: OpsSummaryOptions = {}): Promise<OpsSummaryResponse> {
      return request<OpsSummaryResponse>('/admin/api/ops/summary', { signal: options.signal })
    },

    /** System / database / logs / config detail panels (`GET /admin/api/ops/system`). */
    getSystemDetail(options: OpsSummaryOptions = {}): Promise<OpsSystemDetail> {
      return request<OpsSystemDetail>('/admin/api/ops/system', { signal: options.signal })
    },

    /** Recent log events (`GET /admin/api/ops/logs`). */
    getLogs(options: OpsLogsOptions = {}): Promise<OpsLogsResponse> {
      const qs = options.limit ? `?limit=${encodeURIComponent(String(options.limit))}` : ''
      return request<OpsLogsResponse>(`/admin/api/ops/logs${qs}`, { signal: options.signal })
    },
  }
}

export type OpsApi = ReturnType<typeof createOpsApi>
