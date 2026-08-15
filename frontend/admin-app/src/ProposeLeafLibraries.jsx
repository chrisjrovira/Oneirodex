import { useMemo, useState } from 'react'

import { DataTable } from './DataTable'
import {
  confirmCreateSelected,
  fetchProposeLeafLibraries,
} from './proposeLeafLibrariesApi'
import './ProposeLeafLibraries.css'

/**
 * Admin: propose per-platform leaf libraries under a console/tree root,
 * multi-select candidates, create only on confirm (never auto-create).
 */
export function ProposeLeafLibraries({
  heading = 'Propose leaf libraries',
  lede = 'Point at a console or platform tree root. Review candidates, then confirm — GameTheca never auto-creates libraries or family mega-libs.',
} = {}) {
  const [root, setRoot] = useState('')
  const [candidates, setCandidates] = useState([])
  const [proposedRoot, setProposedRoot] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [confirmLog, setConfirmLog] = useState([])

  const selectedCount = selected.size
  const allSelected = candidates.length > 0 && selectedCount === candidates.length

  const selectedRows = useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    [candidates, selected],
  )

  async function onPropose(event) {
    event?.preventDefault?.()
    setLoading(true)
    setError('')
    setStatus('')
    setConfirmLog([])
    setUnavailable(false)
    setCandidates([])
    setSelected(new Set())
    setProposedRoot('')

    try {
      const result = await fetchProposeLeafLibraries(root)
      if (result.unavailable) {
        setUnavailable(true)
        setError(result.error || 'Propose API unavailable.')
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      const rows = result.candidates || []
      setCandidates(rows)
      setProposedRoot(result.root || root.trim())
      if (!rows.length) {
        setStatus(
          'No leaf candidates under this root. Family mega-lib roots and emu/FE installs are never proposed.',
        )
      } else {
        setStatus(
          `${rows.length} candidate${rows.length === 1 ? '' : 's'} — select leaves, then Confirm create. Nothing is created until you confirm.`,
        )
      }
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(candidates.map((c) => c.id)))
  }

  async function onConfirm() {
    if (!selectedRows.length || confirming) return
    const ok = window.confirm(
      `Create ${selectedRows.length} librar${selectedRows.length === 1 ? 'y' : 'ies'} and queue a first scan for each selected leaf?\n\nNothing was created by Propose — only this confirm writes libraries.`,
    )
    if (!ok) return

    setConfirming(true)
    setError('')
    setStatus('Creating selected libraries…')
    try {
      const outcome = await confirmCreateSelected(selectedRows)
      setConfirmLog(outcome.results)
      setStatus(
        `Done: ${outcome.created} created, ${outcome.scanned} scan(s) queued, ${outcome.failed} failed.`,
      )
      if (outcome.created > 0) {
        // Drop successfully created rows from the table so re-confirm is not accidental.
        const failedPaths = new Set(
          outcome.results.filter((r) => !r.ok).map((r) => r.path),
        )
        const kept = candidates.filter((c) => failedPaths.has(c.path) || !selected.has(c.id))
        const keptSelected = new Set(kept.filter((c) => selected.has(c.id)).map((c) => c.id))
        setCandidates(kept)
        setSelected(keptSelected)
      }
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <section className="gt-propose-leaf" aria-labelledby="gt-propose-leaf-title">
      <div className="gt-propose-leaf__header">
        <h2 id="gt-propose-leaf-title" className="gt-admin-panel-title">
          {heading}
        </h2>
        <p className="gt-admin-lede">{lede}</p>
      </div>

      <form className="gt-propose-leaf__form" onSubmit={onPropose}>
        <label className="gt-propose-leaf__label" htmlFor="gt-propose-leaf-root">
          Root path
        </label>
        <div className="gt-propose-leaf__row">
          <input
            id="gt-propose-leaf-root"
            className="gt-propose-leaf__input"
            type="text"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder="/storage/games/_console-gaming"
            autoComplete="off"
            disabled={loading || confirming}
          />
          <button
            type="submit"
            className="gt-btn gt-btn--accent"
            disabled={loading || confirming || !root.trim()}
          >
            {loading ? 'Proposing…' : 'Propose'}
          </button>
        </div>
        <p className="gt-propose-leaf__hint">
          Absolute path under allowed bases. Propose lists candidates only — create happens on Confirm.
        </p>
      </form>

      {unavailable ? (
        <div className="gt-propose-leaf__banner gt-propose-leaf__banner--soft" role="status">
          {error}
        </div>
      ) : null}

      {!unavailable && error ? (
        <div className="gt-propose-leaf__banner gt-propose-leaf__banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {status ? (
        <p className="gt-propose-leaf__status" role="status" aria-live="polite">
          {status}
          {proposedRoot ? (
            <>
              {' '}
              <span className="gt-propose-leaf__muted">
                Root: <code>{proposedRoot}</code>
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="gt-admin-panel gt-propose-leaf__panel">
          <div className="gt-propose-leaf__toolbar">
            <label className="gt-propose-leaf__check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={confirming}
              />
              Select all ({candidates.length})
            </label>
            <button
              type="button"
              className="gt-btn gt-btn--accent"
              onClick={() => void onConfirm()}
              disabled={confirming || selectedCount === 0}
            >
              {confirming
                ? 'Creating…'
                : `Confirm create (${selectedCount})`}
            </button>
          </div>

          {/* Sorting and filtering a scan result is the point of this screen —
              a root scan can propose dozens of folders and "show me the SNES
              ones" was previously a manual read (W27-C1).

              Selection is safe under both: it is held outside the table and
              keyed by row id, so re-ordering or filtering never moves a tick to
              a different row. The Select column opts out of sorting and
              filtering, since neither means anything for a checkbox. */}
          <DataTable
            rows={candidates}
            getRowKey={(row) => row.id}
            emptyMessage="No candidate folders."
            initialSort={{ key: 'suggested_name', dir: 'asc' }}
            dense
            columns={[
              {
                key: 'select',
                label: 'Select',
                sortable: false,
                filterable: false,
                render: (row) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.suggested_name}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    disabled={confirming}
                  />
                ),
              },
              { key: 'suggested_name', label: 'Suggested name' },
              {
                key: 'platform',
                label: 'Platform',
                render: (row) => <code>{row.platform}</code>,
              },
              { key: 'scan_mode', label: 'Mode' },
              { key: 'scan_depth', label: 'Depth' },
              {
                key: 'path',
                label: 'Path',
                render: (row) => (
                  <code className="gt-propose-leaf__path">{row.path}</code>
                ),
              },
              {
                key: 'reason',
                label: 'Reason',
                render: (row) => row.reason || '—',
              },
            ]}
          />
        </div>
      ) : null}

      {confirmLog.length > 0 ? (
        <div className="gt-propose-leaf__log" aria-live="polite">
          <h3 className="gt-admin-panel-title">Confirm results</h3>
          <ul>
            {confirmLog.map((row) => (
              <li key={`${row.path}-${row.stage}-${row.ok}`}>
                <strong>{row.name}</strong>
                {row.ok ? (
                  <span> — {row.note || 'OK'}</span>
                ) : (
                  <span className="gt-propose-leaf__fail"> — {row.error || 'Failed'}</span>
                )}
                <br />
                <code className="gt-propose-leaf__path">{row.path}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
