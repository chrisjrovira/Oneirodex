import { useEffect, useId, useRef, useState } from 'react'
import { deleteJson } from './adminApi'
import { DataTable } from './DataTable'
import './OpenPathModal.css'
import './OpsLogModal.css'

const LOG_COLUMNS = [
  {
    key: 'timestamp',
    label: 'When',
    render: (row) => (row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'),
  },
  { key: 'level', label: 'Level' },
  { key: 'type', label: 'Type' },
  { key: 'text', label: 'Event' },
  {
    key: 'user',
    label: 'User',
    render: (row) => row.user || '—',
  },
]

/**
 * Full system-event log overlay on Ops (replaces the separate Server logs page).
 */
export function OpsLogModal({ open, events = null, loading = false, error = null, onClose, onCleared }) {
  const titleId = useId()
  const closeRef = useRef(null)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    setClearError(null)
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleClear() {
    const ok = window.confirm('Clear all system events? This cannot be undone.')
    if (!ok) return
    setClearing(true)
    setClearError(null)
    try {
      await deleteJson('/admin/api/system_logs/clear')
      onCleared?.()
    } catch (err) {
      setClearError(err?.message || 'Unable to clear logs')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div
      className="od-open-path od-ops-log-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="od-open-path__panel od-ops-log-modal__panel" onClick={(event) => event.stopPropagation()}>
        <div className="od-open-path__toolbar">
          <h2 id={titleId} className="od-open-path__title">
            Full log
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="od-open-path__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="od-ops-log-modal__lede">
          Most recent system events (up to 200). Use column filters for type, level, and text.
        </p>
        <div className="od-ops-log-modal__actions">
          <button
            type="button"
            className="od-cbtn od-cbtn--danger"
            onClick={handleClear}
            disabled={clearing || loading}
          >
            {clearing ? 'Clearing…' : 'Clear all'}
          </button>
          {clearError ? <span className="od-ops-log-modal__error">{clearError}</span> : null}
          {error ? <span className="od-ops-log-modal__error">{error}</span> : null}
        </div>
        <div className="od-ops-log-modal__table">
          {loading && events == null ? (
            <p className="od-admin-lede">Loading events…</p>
          ) : (
            <DataTable
              columns={LOG_COLUMNS}
              rows={events || []}
              getRowKey={(row) => row.id}
              emptyMessage="No system events recorded yet."
              initialSort={{ key: 'timestamp', dir: 'desc' }}
              dense
              columnFilters
              toolbar
            />
          )}
        </div>
      </div>
    </div>
  )
}
