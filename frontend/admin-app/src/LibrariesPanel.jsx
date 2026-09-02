import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getJson, postJsonResult } from './adminApi'
import { ADMIN_TOPBAR_TRAIL_ID } from './useLegacyContextbarPortal'
import { DataTable } from './DataTable'
import { gameCountHeat } from './gameCountHeat'
import { ScanConflictModal } from './ScanConflictModal'
import { useLibraryScan } from './useLibraryScan'
import { showToast } from './utils/toast'
import './LibrariesPanel.css'

const DEFAULT_LIBRARY_IMAGE = '/static/newstyle/default_library.jpg'
const BATCH_SCAN_URL = '/api/admin/libraries/batch/scan'
const BATCH_EDIT_URL = '/api/admin/libraries/batch/edit'
const CATALOG_REFRESH_URL = '/api/licensed-catalog/refresh'
const CATALOG_REFRESH_FLAG = 'od-libraries-catalog-refresh-v1'

function libraryThumb(url) {
  const src = (url || '').trim() || DEFAULT_LIBRARY_IMAGE
  return src
}

function groupLabel(lib) {
  return (lib?.group_name || '').trim()
}

/**
 * Thin-bar “N libraries” control beside account. The menu shows total games
 * with unmatched in parentheses, and a platform filter that drives the table.
 */
function LibrariesTrailSummary({ libraryCount, totalGames, totalUnmatched, platforms, platformFilter, onPlatformFilter }) {
  const [open, setOpen] = useState(false)
  const [needle, setNeedle] = useState('')
  const [trailHost, setTrailHost] = useState(() =>
    typeof document !== 'undefined'
      ? document.getElementById(ADMIN_TOPBAR_TRAIL_ID)
      : null,
  )
  const rootRef = useRef(null)
  const panelId = useId()

  useLayoutEffect(() => {
    setTrailHost(document.getElementById(ADMIN_TOPBAR_TRAIL_ID))
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const matches = useMemo(() => {
    const q = needle.trim().toLowerCase()
    if (!q) return platforms
    return platforms.filter((row) => row.platform.toLowerCase().includes(q))
  }, [needle, platforms])

  const label = libraryCount === 1 ? '1 library' : `${libraryCount} libraries`
  const gamesLabel = totalGames === 1 ? '1 game' : `${totalGames} games`
  const unmatchedLabel =
    totalUnmatched === 1 ? '1 unmatched' : `${totalUnmatched} unmatched`

  const control = (
    <div className="od-pop od-libraries-trail" data-align="end" ref={rootRef}>
      <button
        type="button"
        className={`od-cbtn od-contextbar__count${open ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div
          id={panelId}
          className="od-pop__panel od-libraries-trail__panel"
          role="dialog"
          aria-label="Libraries summary"
        >
          <div className="od-pop__head">
            <span className="od-pop__title">Libraries</span>
            <button type="button" className="od-cbtn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
          <p className="od-libraries-trail__totals">
            {gamesLabel}
            <span className="od-libraries-trail__unmatched"> ({unmatchedLabel})</span>
          </p>
          <label className="od-libraries-trail__filter">
            <input
              type="search"
              className="od-table__col-filter"
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="Filter by platform…"
              aria-label="Filter by platform"
              autoComplete="off"
            />
          </label>
          {platformFilter ? (
            <button
              type="button"
              className="od-cbtn od-libraries-trail__clear"
              onClick={() => {
                onPlatformFilter('')
                setNeedle('')
              }}
            >
              Clear platform filter
            </button>
          ) : null}
          <ul className="od-libraries-trail__list">
            {matches.length === 0 ? (
              <li className="od-libraries-trail__empty">No platforms match.</li>
            ) : (
              matches.map((row) => (
                <li key={row.platform}>
                  <button
                    type="button"
                    className={`od-libraries-trail__row${
                      platformFilter === row.platform ? ' is-active' : ''
                    }`}
                    onClick={() => {
                      onPlatformFilter(
                        platformFilter === row.platform ? '' : row.platform,
                      )
                      setOpen(false)
                    }}
                  >
                    <span className="od-libraries-trail__name">{row.platform}</span>
                    <span className="od-libraries-trail__n">
                      {row.games}
                      <span className="od-libraries-trail__n-unmatched">
                        {' '}
                        ({row.unmatched})
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )

  if (trailHost) {
    return createPortal(control, trailHost)
  }
  return control
}

async function kickCatalogRefresh(rows) {
  if (typeof window === 'undefined') return
  try {
    if (window.sessionStorage?.getItem(CATALOG_REFRESH_FLAG)) return
  } catch {
    return
  }
  const keys = [
    ...new Set(
      (rows || [])
        .map((lib) => lib.platform_key)
        .filter((key) => key && key !== 'PCWIN' && key !== 'PCDOS' && key !== 'MAC'),
    ),
  ].slice(0, 6)
  if (!keys.length) return
  try {
    window.sessionStorage?.setItem(CATALOG_REFRESH_FLAG, '1')
  } catch {
    /* private mode */
  }
  for (const platform of keys) {
    try {
      await postJsonResult(CATALOG_REFRESH_URL, { library_platform: platform })
    } catch {
      /* best-effort; estimates already color the table */
    }
  }
}

function GroupDialog({ targets, existingNames, onClose, onSave, busy }) {
  const titleId = useId()
  const listId = useId()
  const shared = targets.length
    ? targets.every((lib) => groupLabel(lib) === groupLabel(targets[0]))
      ? groupLabel(targets[0])
      : ''
    : ''
  const [name, setName] = useState(shared)
  const inputRef = useRef(null)
  const anyGroupedTargets = targets.some((lib) => groupLabel(lib))

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  if (!targets.length) return null

  const count = targets.length
  const heading = count === 1 ? `Group ${targets[0].name}` : `Group ${count} libraries`

  return (
    <div
      className="od-libraries-group"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose?.()
      }}
    >
      <div
        className="od-libraries-group__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="od-libraries-group__title">
          {heading}
        </h2>
        <p className="od-libraries-group__lede">
          Libraries that share a group name sit together. Clear the name to
          ungroup. The Group column only appears when at least one library is
          grouped.
        </p>
        <label className="od-libraries-group__field">
          <span>Group name</span>
          <input
            ref={inputRef}
            type="text"
            className="od-table__col-filter od-libraries-group__input"
            value={name}
            list={existingNames.length ? listId : undefined}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Arcade cabinets"
          />
        </label>
        {existingNames.length ? (
          <datalist id={listId}>
            {existingNames.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        ) : null}
        <div className="od-libraries-group__actions">
          <button type="button" className="od-cbtn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {anyGroupedTargets ? (
            <button
              type="button"
              className="od-cbtn"
              disabled={busy}
              onClick={() => onSave('')}
            >
              Ungroup
            </button>
          ) : null}
          <button
            type="button"
            className="od-cbtn od-cbtn--primary"
            disabled={busy || !name.trim()}
            onClick={() => onSave(name)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Libraries list for the Jinja Libraries pane — DataTable with inline
 * typeahead filters, themed row actions, grouping, and multi-select batch
 * Scan/Edit/Delete/Group.
 */
export function LibrariesPanel({ panelEl = null }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [platformFilter, setPlatformFilter] = useState('')
  const [groupTargets, setGroupTargets] = useState(null)
  const [groupBusy, setGroupBusy] = useState(false)
  const {
    conflictOpen,
    busyKey,
    startScan,
    onConflictChoose,
    onConflictClose,
  } = useLibraryScan()

  const reload = useCallback(() => {
    setError(null)
    return getJson('/api/get_libraries')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => {
        setError(err)
        setRows([])
      })
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!rows?.length) return undefined
    void kickCatalogRefresh(rows).then(() => {
      /* After a first-wave IGDB refresh, reload once so DAT/IGDB totals replace estimates. */
      const flagged = (() => {
        try {
          return window.sessionStorage?.getItem(`${CATALOG_REFRESH_FLAG}:reloaded`)
        } catch {
          return '1'
        }
      })()
      if (flagged) return
      try {
        window.sessionStorage?.setItem(`${CATALOG_REFRESH_FLAG}:reloaded`, '1')
      } catch {
        /* ignore */
      }
      void reload()
    })
    return undefined
  }, [rows, reload])

  const editUrlTemplate =
    panelEl?.getAttribute('data-edit-url-template') ||
    '/admin/library/__UUID__/edit'

  const toggleOne = useCallback((uuid, on) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(uuid)
      else next.delete(uuid)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (on) => {
      if (!rows) return
      setSelected(on ? new Set(rows.map((r) => r.uuid)) : new Set())
    },
    [rows],
  )

  const selectedList = useMemo(() => {
    if (!rows) return []
    return rows.filter((r) => selected.has(r.uuid))
  }, [rows, selected])

  const askDelete = useCallback((targets) => {
    if (typeof window.odLibrariesAskDelete === 'function') {
      window.odLibrariesAskDelete(targets)
      return
    }
    showToast('Delete confirm is unavailable on this page.', 'error')
  }, [])

  const openBatchEdit = useCallback(() => {
    if (typeof window.odLibrariesOpenBatchEdit === 'function') {
      window.odLibrariesOpenBatchEdit(selectedList)
      return
    }
    showToast('Batch edit is unavailable on this page.', 'error')
  }, [selectedList])

  const batchScan = useCallback(async () => {
    if (!selectedList.length) return
    const { ok, data } = await postJsonResult(BATCH_SCAN_URL, {
      library_uuids: selectedList.map((r) => r.uuid),
      queue_policy: 'queue',
    })
    if (!ok) {
      showToast(data?.error || data?.message || 'Batch scan failed.', 'error')
      return
    }
    showToast(
      data?.message || `Queued scan for ${selectedList.length} libraries.`,
      'success',
    )
  }, [selectedList])

  const saveGroup = useCallback(
    async (name) => {
      if (!groupTargets?.length) return
      setGroupBusy(true)
      const { ok, data } = await postJsonResult(BATCH_EDIT_URL, {
        library_uuids: groupTargets.map((r) => r.uuid),
        group_name: name,
      })
      setGroupBusy(false)
      if (!ok) {
        showToast(data?.error || data?.message || 'Could not update group.', 'error')
        return
      }
      setGroupTargets(null)
      void reload()
    },
    [groupTargets, reload],
  )

  useEffect(() => {
    const onDeleted = () => {
      setSelected(new Set())
      void reload()
    }
    window.addEventListener('od-libraries-deleted', onDeleted)
    return () => window.removeEventListener('od-libraries-deleted', onDeleted)
  }, [reload])

  const anyGrouped = Boolean(rows?.some((lib) => groupLabel(lib)))
  const existingGroups = useMemo(() => {
    const seen = new Set()
    const names = []
    for (const lib of rows || []) {
      const name = groupLabel(lib)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      names.push(name)
    }
    return names
  }, [rows])

  const visibleRows = useMemo(() => {
    if (!rows) return []
    const wanted = platformFilter.trim().toLowerCase()
    if (!wanted) return rows
    return rows.filter(
      (lib) => String(lib.platform || '').trim().toLowerCase() === wanted,
    )
  }, [platformFilter, rows])

  const totalGames = useMemo(
    () => (rows || []).reduce((sum, lib) => sum + (Number(lib.game_count) || 0), 0),
    [rows],
  )

  const totalUnmatched = useMemo(
    () => (rows || []).reduce((sum, lib) => sum + (Number(lib.unmatched_count) || 0), 0),
    [rows],
  )

  const platforms = useMemo(() => {
    const byPlatform = new Map()
    for (const lib of rows || []) {
      const platform = String(lib.platform || '').trim() || 'Unknown'
      const current = byPlatform.get(platform) || { platform, games: 0, unmatched: 0 }
      current.games += Number(lib.game_count) || 0
      current.unmatched += Number(lib.unmatched_count) || 0
      byPlatform.set(platform, current)
    }
    return [...byPlatform.values()].sort((a, b) =>
      a.platform.localeCompare(b.platform, undefined, { numeric: true }),
    )
  }, [rows])

  const actionButtons = useCallback(
    (lib) => (
      <div className="od-cbtn-group od-libraries-actions" role="group" aria-label={`${lib.name} actions`}>
        <button
          type="button"
          className="od-cbtn"
          disabled={busyKey === lib.uuid}
          title={
            lib.last_scan_folder
              ? `Scan ${lib.last_scan_folder}`
              : 'No last scan folder — run Auto scan once first.'
          }
          onClick={() =>
            void startScan({
              key: lib.uuid,
              libraryUuid: lib.uuid,
              label: lib.name,
            })
          }
        >
          {busyKey === lib.uuid ? '…' : 'Scan'}
        </button>
        <a
          className="od-cbtn"
          href={editUrlTemplate.replace('__UUID__', lib.uuid)}
        >
          Edit
        </a>
        <button
          type="button"
          className="od-cbtn od-cbtn--danger"
          onClick={() => askDelete([{ uuid: lib.uuid, name: lib.name }])}
        >
          Delete
        </button>
        <button
          type="button"
          className="od-cbtn"
          onClick={() => setGroupTargets([lib])}
        >
          Group
        </button>
      </div>
    ),
    [askDelete, busyKey, editUrlTemplate, startScan],
  )

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'select',
        label: (
          <span className="od-libraries-select-all">
            <input
              type="checkbox"
              className="form-check-input"
              checked={Boolean(rows?.length && selected.size === rows.length)}
              ref={(el) => {
                if (el && rows) {
                  el.indeterminate = selected.size > 0 && selected.size < rows.length
                }
              }}
              onChange={(event) => toggleAll(event.target.checked)}
              aria-label="Select all libraries"
              title="Select all"
            />
          </span>
        ),
        sortable: false,
        filterable: false,
        render: (lib) => (
          <input
            type="checkbox"
            className="form-check-input od-library-row-check"
            checked={selected.has(lib.uuid)}
            data-library-uuid={lib.uuid}
            data-library-name={lib.name}
            aria-label={`Select ${lib.name}`}
            onChange={(event) => toggleOne(lib.uuid, event.target.checked)}
          />
        ),
      },
    ]
    if (anyGrouped) {
      cols.push({
        key: 'group_name',
        label: 'Group',
        value: (lib) => groupLabel(lib),
      })
    }
    cols.push(
      {
        key: 'name',
        label: 'Library',
        value: (lib) => lib.name || '',
        render: (lib) => (
          <span className="od-libraries-name">
            <img
              className="od-libraries-name__thumb"
              src={libraryThumb(lib.image_url)}
              alt=""
              width={30}
              height={30}
              loading="lazy"
              onError={(event) => {
                if (event.currentTarget.src.endsWith(DEFAULT_LIBRARY_IMAGE)) return
                event.currentTarget.src = DEFAULT_LIBRARY_IMAGE
              }}
            />
            <span className="od-libraries-name__text">{lib.name}</span>
          </span>
        ),
      },
      {
        key: 'platform',
        label: 'Platform',
        value: (lib) => lib.platform || '',
      },
      {
        key: 'game_count',
        label: 'Games',
        value: (lib) => Number(lib.game_count) || 0,
        render: (lib) => {
          const heat = gameCountHeat(lib.game_count, lib.platform_total)
          return (
            <span
              className="od-libraries-count"
              style={heat ? { color: heat.color } : undefined}
              title={heat?.title}
            >
              {Number(lib.game_count) || 0}
            </span>
          )
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        filterable: false,
        render: actionButtons,
      },
    )
    return cols
  }, [actionButtons, anyGrouped, rows, selected, toggleAll, toggleOne])

  if (error && !rows) {
    return <p className="od-admin-lede od-error">Unable to load libraries.</p>
  }

  if (!rows) {
    return <p className="od-admin-lede">Loading libraries…</p>
  }

  const n = selectedList.length
  const libraryCount = rows.length

  return (
    <div className="od-libraries-react">
      <LibrariesTrailSummary
        libraryCount={libraryCount}
        totalGames={totalGames}
        totalUnmatched={totalUnmatched}
        platforms={platforms}
        platformFilter={platformFilter}
        onPlatformFilter={setPlatformFilter}
      />
      {n > 0 ? (
        <div className="od-libraries-toolbar">
          <div className="od-libraries-batch-bar" id="odLibrariesBatchBarReact">
            <div className="od-libraries-batch-bar__inner">
              <span className="od-libraries-batch-bar__count">
                {n === 1 ? '1 selected' : `${n} selected`}
              </span>
              <button type="button" className="od-cbtn" onClick={() => void batchScan()}>
                Scan
              </button>
              <button type="button" className="od-cbtn" onClick={openBatchEdit}>
                Edit
              </button>
              <button
                type="button"
                className="od-cbtn od-cbtn--danger"
                onClick={() => askDelete(selectedList.map((r) => ({ uuid: r.uuid, name: r.name })))}
              >
                Delete
              </button>
              <button
                type="button"
                className="od-cbtn"
                onClick={() => setGroupTargets(selectedList)}
              >
                Group
              </button>
              <button type="button" className="od-cbtn" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DataTable
        rows={visibleRows}
        getRowKey={(lib) => lib.uuid}
        columns={columns}
        toolbar={false}
        columnFilters
        showCount={false}
        dense
        emptyMessage="No libraries yet. Add one from Libraries → Add library."
        initialSort={{ key: 'name', dir: 'asc' }}
      />

      <ScanConflictModal
        open={conflictOpen}
        busy={Boolean(busyKey)}
        onChoose={onConflictChoose}
        onClose={onConflictClose}
      />

      {groupTargets ? (
        <GroupDialog
          key={groupTargets.map((lib) => lib.uuid).join(',')}
          targets={groupTargets}
          existingNames={existingGroups}
          busy={groupBusy}
          onClose={() => setGroupTargets(null)}
          onSave={(name) => void saveGroup(name)}
        />
      ) : null}
    </div>
  )
}
