import { type DataTableColumn } from '../../components/DataTable'
import { formatScanJobCounters } from '../../components/opsWidgets'

/* Detail-panel registry, column tables and DetailPanel moved out of OpsPage (v11 cycle, H-D.2), unchanged. */

export const DETAIL_PANELS: Record<string, string> = {
  system: 'System',
  database: 'Database',
  logs: 'Logs',
  config: 'Configuration',
  theme_assets: 'Theme assets',
}

export const DETAIL_PANEL_IDS = Object.keys(DETAIL_PANELS)

export const COMPANION_KIND_COLUMNS: DataTableColumn[] = [
  { key: 'kind', label: 'Kind' },
  { key: 'online', label: 'Online', align: 'right' },
  { key: 'registered', label: 'Registered', align: 'right' },
]

export const SCAN_JOB_COLUMNS: DataTableColumn[] = [
  {
    key: 'id',
    label: 'Job',
    render: (job) => <code>#{job.id_short || job.id}</code>,
    value: (job) => job.id_short || job.id,
  },
  { key: 'library', label: 'Library', render: (job) => job.library || '—' },
  { key: 'status', label: 'Status' },
  {
    key: 'progress',
    label: 'Progress',
    render: (job) => formatScanJobCounters(job),
    value: (job) => Number(job.folders_success ?? 0) + Number(job.folders_failed ?? 0),
  },
  {
    key: 'detail',
    label: 'Detail',
    render: (job) => {
      if (job.error_message) {
        return <span className="od-ops-table__error">{job.error_message}</span>
      }
      if (job.stalled) {
        return <span className="od-ops-table__muted">No progress reported</span>
      }
      return <span className="od-ops-table__muted">{job.current_processing || '—'}</span>
    },
  },
]

export const RECENT_ERROR_COLUMNS: DataTableColumn[] = [
  { key: 'event_type', label: 'Type', render: (event) => <code>{event.event_type}</code> },
  { key: 'text', label: 'Message' },
]

/**
 * A key/value block in the Ops console. Board drag replaces ↑↓ reorder.
 */
export function DetailPanel({
  title,
  values,
}: {
  title: string
  values?: Record<string, unknown>
}) {
  const entries = Object.entries(values || {})
  if (entries.length === 0) return null

  return (
    <section className="od-ops-panel od-ops-panel--embedded">
      <div className="od-ops-panel__head">
        <h2>{title}</h2>
      </div>
      <table className="od-ops-table">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
