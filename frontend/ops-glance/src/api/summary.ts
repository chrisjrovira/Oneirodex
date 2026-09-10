import { getCsrfToken } from '@oneirodex/ui'
import { createOneirodexBrowserClient } from '@oneirodex/api-client'

/**
 * Shape of `GET /admin/api/ops/summary` (`oneirodex/utils/ops_summary.py`
 * `build_ops_summary`). Every section is nullable — the backend replaces a
 * section that failed to collect with `null` plus a `<section>_error` string,
 * and never tanks the poll.
 */

export interface OpsMeter {
  total?: number | null
  used?: number | null
  free?: number | null
  available?: number | null
  percent?: number | null
}

export interface OpsHostCpu {
  percent?: number | null
  cores_physical?: number | null
  cores_logical?: number | null
}

export interface OpsHost {
  os?: string | null
  hostname?: string | null
  ip?: string | null
  python?: string | null
  cpu?: OpsHostCpu | null
  memory?: OpsMeter | null
  disk_base?: OpsMeter | null
  disk_games?: OpsMeter | null
  uptime_system?: string | null
  uptime_app?: string | null
}

export interface OpsNetwork {
  bytes_sent?: number | null
  bytes_recv?: number | null
  packets_sent?: number | null
  packets_recv?: number | null
  connections?: number | null
  errin?: number | null
  errout?: number | null
  dropin?: number | null
  dropout?: number | null
}

export type OpsSeverity = 'good' | 'warn' | 'bad'

export interface OpsIssueItem {
  id: string | number
  severity: string
  message: string
  href?: string | null
}

export interface OpsIssues {
  overall?: OpsSeverity | string
  items?: OpsIssueItem[]
}

export interface OpsScanJob {
  id: string | number
  library?: string | null
  status?: string | null
  progress?: number | null
  errors?: number | null
}

export interface OpsScans {
  active_count?: number | null
  jobs?: OpsScanJob[]
}

export interface OpsLibrary {
  libraries?: number | null
  games?: number | null
  unmatched_folders?: number | null
  download_requests_open?: number | null
}

export interface OpsRecentError {
  id: string | number
  timestamp?: string | null
  text?: string | null
}

export interface OpsSummary {
  as_of?: string | null
  host?: OpsHost | null
  network?: OpsNetwork | null
  issues?: OpsIssues | null
  scans?: OpsScans | null
  library?: OpsLibrary | null
  recent_errors?: OpsRecentError[] | null
  host_error?: string
  network_error?: string
  scans_error?: string
  library_error?: string
  services_error?: string
  recent_errors_error?: string
  [key: string]: unknown
}

export interface FetchOpsSummaryOptions {
  signal?: AbortSignal
}

/**
 * Same-origin browser client (ADR 0005). `getToken` is unused on this
 * transport; a 401 bounces to the login page and `OneirodexApiError` carries
 * the envelope sentence + `status` / `error_code` for `PageStatus`.
 */
const client = createOneirodexBrowserClient({
  baseUrl: '',
  fetchImpl: (input, init) => window.fetch(input, init),
  csrfToken: () => getCsrfToken(),
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})

export async function fetchOpsSummary({
  signal,
}: FetchOpsSummaryOptions = {}): Promise<OpsSummary> {
  return (await client.ops.getSummary({ signal })) as OpsSummary
}
