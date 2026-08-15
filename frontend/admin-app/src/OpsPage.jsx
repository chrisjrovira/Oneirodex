import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DataTable } from './DataTable'
import { useWidgetOrder } from './useWidgetOrder'
import {
  LibraryHealthFactors,
  MeterBar,
  MetricTile,
  OpsStatusBanner,
  companionKindRows,
  formatBytes,
  formatLibraryHealthHint,
  formatLibraryHealthValue,
  formatLibraryWatchDetail,
  formatLibraryWatchStatus,
  formatLoadAvg,
  formatReadyz,
  libraryHealthTone,
  na,
  normalizeLibraryHealth,
  booleanTone,
  usageTone,
} from './opsWidgets'
import './ops.css'

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
}

/** Honest scan glance: processed (= success+failed) / total, matching Scan Jobs. */
export function formatScanJobCounters(job) {
  const success = Number(job?.folders_success) || 0
  const failed = Number(job?.folders_failed) || 0
  const total = Number(job?.total_folders) || 0
  const processed = success + failed
  if (total > 0) {
    return `${processed}/${total}` + (failed ? ` · ${failed} failed` : '')
  }
  if (job?.status === 'Queued' || job?.status === 'Pending') {
    return job?.queue_position != null ? `Queued #${job.queue_position}` : 'Queued'
  }
  if (job?.status === 'Running' || job?.status === 'Stopping') {
    return 'Starting…'
  }
  if (job?.progress != null && Number(job.progress) > 0) {
    return `${job.progress}%`
  }
  return '—'
}

function livekitLabel(livekit) {
  if (!livekit) return 'n/a'
  if (livekit.configured) {
    if (livekit.reachable === true) return 'reachable'
    if (livekit.reachable === false) return 'unreachable'
    return 'configured'
  }
  if (livekit.enabled) return 'enabled (missing secrets)'
  return 'off'
}

/** Panel id → heading. The ids are the keys of the /admin/api/ops/system
 *  payload, so a panel and its data cannot drift apart. */
const DETAIL_PANELS = {
  system: 'System',
  database: 'Database',
  logs: 'Logs',
  config: 'Configuration',
  theme_assets: 'Theme assets',
}

const DETAIL_PANEL_IDS = Object.keys(DETAIL_PANELS)

/**
 * A key/value block in the Ops console.
 *
 * The System, Database and Logs panels were three copies of the same fifteen
 * lines, so adding Configuration would have made four. Deliberately a plain
 * table and not a DataTable: these are read top to bottom, and a filter box
 * above six rows of host facts is more chrome than content.
 *
 * Renders nothing when there is no data, rather than an empty frame implying a
 * reading that failed — "no section" and "a section that came back blank" would
 * otherwise look identical.
 */
function DetailPanel({ title, values, onMove, canMoveUp, canMoveDown }) {
  const entries = Object.entries(values || {})
  if (entries.length === 0) return null

  return (
    <section className="gt-ops-panel">
      {/* Move controls, not drag handles.
       *
       * Buttons are the whole mechanism rather than a fallback bolted onto a
       * drag: they work with a keyboard, a screen reader, a touch screen and a
       * mouse without any of them being a second-class path, and they need no
       * drag library. Reordering rewrites the DOM rather than setting CSS
       * `order`, because visual order that disagrees with tab order is a worse
       * bug than the one being fixed.
       *
       * Ends are disabled rather than hidden, so the control group does not
       * change width as a panel moves and the buttons stay where the hand
       * expects them. */}
      <div className="gt-ops-panel__head">
        <h2>{title}</h2>
        {onMove ? (
          <div className="gt-ops-panel__move" role="group" aria-label={`Reorder ${title}`}>
            <button
              type="button"
              className="gt-cbtn gt-cbtn--icon"
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
              aria-label={`Move ${title} earlier`}
            >
              ↑
            </button>
            <button
              type="button"
              className="gt-cbtn gt-cbtn--icon"
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
              aria-label={`Move ${title} later`}
            >
              ↓
            </button>
          </div>
        ) : null}
      </div>
      <table className="gt-ops-table">
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

export function OpsPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  /** Initial mount only — never flash content away on background poll. */
  const [bootLoading, setBootLoading] = useState(true)
  /** Manual Refresh button feedback only. */
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  // Server status folded in (GT-B21 · UID-015). Separate request from the
  // summary poll: these values barely move, so re-fetching them every 15s to
  // learn the OS name would be wasted work.
  const [systemDetail, setSystemDetail] = useState(null)
  const [recentLogs, setRecentLogs] = useState(null)
  // Only the panels that actually have data, because `DetailPanel` renders
  // nothing without any — and a slot held by something invisible poisons the
  // reordering it takes part in. Passing the *declared* five meant the last
  // visible panel's ↓ stayed enabled (it had an absent panel below it) and one
  // press swapped it with nothing the operator could see. Reachable for real:
  // `get_config_values()` returns `{}` when none of its whitelisted paths are
  // configured, and `theme_assets` is absent against any older backend.
  //
  // The order preference is a superset held inside `useWidgetOrder`, so a panel
  // dropping out here does not cost it its saved position when it comes back.
  const presentDetailIds = useMemo(
    () =>
      DETAIL_PANEL_IDS.filter(
        (id) => Object.keys(systemDetail?.[id] || {}).length > 0,
      ),
    [systemDetail],
  )
  const detailOrder = useWidgetOrder('ops-detail', presentDetailIds)
  const requestRef = useRef({ id: 0, controller: null })
  const hasSnapshotRef = useRef(false)

  const refresh = useCallback((source = 'poll') => {
    const isManual = source === 'manual'
    const isBoot = source === 'boot'
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    if (isManual) setManualRefreshing(true)
    getJson('/admin/api/ops/summary')
      .then((data) => {
        if (requestRef.current.id !== id || controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
        setLastUpdatedAt(new Date())
        hasSnapshotRef.current = true
        if (isBoot) setBootLoading(false)
        if (isManual) setManualRefreshing(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (requestRef.current.id !== id) return
        setError(err)
        if (isBoot || !hasSnapshotRef.current) setBootLoading(false)
        if (isManual) setManualRefreshing(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    getJson('/admin/api/ops/system')
      .then((data) => {
        if (!cancelled) setSystemDetail(data)
      })
      .catch(() => {
        // Soft-fail: one unavailable stat source must not blank the console.
        if (!cancelled) setSystemDetail(null)
      })

    // Separate request from the system detail (W27-D2). A failing log read must
    // not take the host panels down with it, and vice versa — they are two
    // independent reasons the console could be partially unavailable.
    getJson('/admin/api/ops/logs?limit=50')
      .then((data) => {
        if (!cancelled) setRecentLogs(data?.events || [])
      })
      .catch(() => {
        if (!cancelled) setRecentLogs(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refresh('boot')
    const timer = window.setInterval(() => refresh('poll'), 15000)
    return () => {
      window.clearInterval(timer)
      requestRef.current.controller?.abort()
    }
  }, [refresh])

  const host = snapshot?.host
  const library = snapshot?.library
  const scans = snapshot?.scans
  const services = snapshot?.services
  const issues = snapshot?.issues
  const severity = issues?.overall || 'good'
  const companions = services?.companions
  const kindRows = companionKindRows(companions?.by_kind)
  const lastSeen = companions?.last_seen

  return (
    <div className="gt-admin-page gt-ops-page">
      <div className="gt-ops-header">
        <div>
          <h1>System · Ops</h1>
          <p className="gt-admin-lede">Observability console — host, readiness, companions, scans (~15s).</p>
        </div>
        <div className="gt-ops-refresh">
          {manualRefreshing ? (
            <span className="gt-ops-refresh__status" role="status" aria-live="polite">
              Refreshing…
            </span>
          ) : lastUpdatedAt ? (
            <span className="gt-ops-refresh__status gt-ops-refresh__status--muted">
              Updated {lastUpdatedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            className="gt-btn gt-btn--accent"
            onClick={() => refresh('manual')}
            disabled={manualRefreshing || bootLoading}
          >
            {manualRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="gt-admin-alert">
          Unable to load ops summary ({error.message}).
        </div>
      ) : null}

      {bootLoading && !snapshot ? (
        <p className="gt-admin-lede" role="status">
          Loading ops summary…
        </p>
      ) : null}

      <OpsStatusBanner
        severity={severity}
        asOf={snapshot?.as_of}
        items={issues?.items}
        ariaLabel="System status"
      />

      <div className="gt-ops-strip" aria-label="Key metrics">
        <MetricTile
          label="CPU"
          value={na(host?.cpu?.percent, '%')}
          hint={na(host?.cpu?.cores_logical, ' cores')}
          tone={usageTone(host?.cpu?.percent)}
        />
        <MetricTile label="Load 1/5/15" value={formatLoadAvg(host?.load_avg)} hint="host" />
        <MetricTile
          label="Memory"
          value={na(host?.memory?.percent, '%')}
          hint={
            host?.memory
              ? `${formatBytes(host.memory.used)} / ${formatBytes(host.memory.total)}`
              : 'n/a'
          }
          tone={usageTone(host?.memory?.percent)}
        />
        <MetricTile
          label="Process RSS"
          value={formatBytes(host?.process?.rss_bytes)}
          hint={host?.process?.pid != null ? `pid ${host.process.pid}` : 'n/a'}
        />
        <MetricTile
          label="DB ping"
          value={host?.db_ping_ms != null ? `${host.db_ping_ms} ms` : 'n/a'}
          hint="SELECT 1"
          // Milliseconds, not a percentage — a healthy local DB answers in single digits.
          tone={usageTone(host?.db_ping_ms, { warn: 50, bad: 250 })}
        />
        <MetricTile
          label="Readyz"
          value={formatReadyz(services?.readyz)}
          hint={na(services?.readyz?.http_status)}
          tone={booleanTone(
            services?.readyz == null ? null : services?.readyz?.http_status === 200,
          )}
        />
        <MetricTile
          label="Companions"
          value={`${companions?.online ?? 0} / ${companions?.registered ?? 0}`}
          hint={`${lastSeen?.within_1h ?? 0} in 1h · ${lastSeen?.stale ?? 0} stale`}
        />
        <MetricTile
          label="Games disk"
          value={na(host?.disk_games?.percent ?? host?.disk_base?.percent, '%')}
          hint="volume use"
          tone={usageTone(host?.disk_games?.percent ?? host?.disk_base?.percent)}
        />
        <MetricTile
          label="Library watch"
          value={formatLibraryWatchStatus(services?.library_watch)}
          hint={
            services?.library_watch?.enabled
              ? `${services.library_watch.roots ?? 0} roots · ${services.library_watch.pending_libraries ?? 0} pending`
              : 'GT_LIBRARY_WATCH off'
          }
        />
        <MetricTile
          label="Library health"
          value={formatLibraryHealthValue(library?.health)}
          hint={formatLibraryHealthHint(library?.health)}
          tone={libraryHealthTone(library?.health)}
        />
      </div>

      <div className="gt-ops-console">
        <section className="gt-ops-panel">
          <h2>Host meters</h2>
          {!host ? (
            <p>{snapshot?.host_error || 'Host data unavailable.'}</p>
          ) : (
            <>
              <p className="gt-ops-panel__lede">
                <strong>{host.hostname || 'Unknown host'}</strong>
                {' · '}
                {host.os || 'Unknown OS'} · {host.ip || 'No IP'}
                {' · '}
                up {host.uptime_system || 'n/a'} / app {host.uptime_app || 'n/a'}
              </p>
              <div className="gt-ops-meters">
                <MeterBar
                  label="CPU"
                  percent={host.cpu?.percent}
                  detail={host.cpu?.cores_logical != null ? `${host.cpu.cores_logical} logical cores` : null}
                />
                <MeterBar
                  label="Memory"
                  percent={host.memory?.percent}
                  detail={
                    host.memory
                      ? `${formatBytes(host.memory.used)} / ${formatBytes(host.memory.total)}`
                      : null
                  }
                />
                <MeterBar
                  label="App disk"
                  percent={host.disk_base?.percent}
                  detail={
                    host.disk_base
                      ? `${formatBytes(host.disk_base.used)} / ${formatBytes(host.disk_base.total)}`
                      : null
                  }
                />
                <MeterBar
                  label="Games disk"
                  percent={host.disk_games?.percent}
                  detail={
                    host.disk_games
                      ? `${formatBytes(host.disk_games.used)} / ${formatBytes(host.disk_games.total)}`
                      : null
                  }
                />
              </div>
            </>
          )}
        </section>

        <section className="gt-ops-panel gt-ops-panel--services">
          <h2>Services</h2>
          {!services ? (
            <p>{snapshot?.services_error || 'Services data unavailable.'}</p>
          ) : (
            <div className="gt-ops-panel__scroll">
              <table className="gt-ops-table gt-ops-table--services">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Readyz</td>
                    <td>{formatReadyz(services.readyz)}</td>
                    <td>
                      {services.readyz?.checks
                        ? Object.entries(services.readyz.checks)
                            .map(([k, v]) => `${k}:${typeof v === 'object' ? v?.status || JSON.stringify(v) : v}`)
                            .join(' · ') || 'n/a'
                        : 'n/a'}
                    </td>
                  </tr>
                  <tr>
                    <td>LiveKit</td>
                    <td>{livekitLabel(services.livekit)}</td>
                    <td>{services.livekit?.error || '—'}</td>
                  </tr>
                  <tr>
                    <td>Malware</td>
                    <td>{services.malware?.enabled ? 'on' : 'off'}</td>
                    <td>
                      {services.malware?.enabled
                        ? `ClamAV ${services.malware.clamav_reachable ? 'up' : 'down (heuristics only)'}`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Queues</td>
                    <td>
                      {services.queues?.scans_active ?? 0} active · {services.queues?.scans_pending ?? 0} pending
                    </td>
                    <td>{services.queues?.downloads_open ?? 0} downloads open</td>
                  </tr>
                  <tr>
                    <td>Library watch</td>
                    <td>{formatLibraryWatchStatus(services.library_watch)}</td>
                    <td>{formatLibraryWatchDetail(services.library_watch)}</td>
                  </tr>
                  {(services.game_servers?.servers || []).map((server) => (
                    <tr key={server.uuid || server.display_name}>
                      <td>Game server · {server.display_name || 'unnamed'}</td>
                      <td>
                        {server.reachable === true
                          ? 'reachable'
                          : server.reachable === false
                            ? 'unreachable'
                            : 'n/a'}
                      </td>
                      <td>{server.error || server.method || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="gt-ops-panel">
          <h2>Companions</h2>
          {!companions ? (
            <p>n/a</p>
          ) : (
            <>
              <p className="gt-ops-panel__lede">
                Online {companions.online ?? 0} / {companions.registered ?? 0}
                {' · '}
                window {companions.window_minutes ?? 3}m
                {' · '}
                newest {lastSeen?.newest ? new Date(lastSeen.newest).toLocaleString() : 'n/a'}
                {' · '}
                1h {lastSeen?.within_1h ?? 0} · 24h {lastSeen?.within_24h ?? 0} · stale {lastSeen?.stale ?? 0}
              </p>
              {kindRows.length === 0 ? (
                <p className="gt-admin-lede">No registered companions by kind.</p>
              ) : (
                <table className="gt-ops-table">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Online</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kindRows.map((row) => (
                      <tr key={row.kind}>
                        <td>{row.kind}</td>
                        <td>{row.online}</td>
                        <td>{row.registered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>

        <section className="gt-ops-panel">
          <h2>Library pulse</h2>
          {!library ? (
            <p>{snapshot?.library_error || 'Library data unavailable.'}</p>
          ) : (
            <>
              <div className="gt-ops-strip gt-ops-strip--compact">
                <MetricTile label="Libraries" value={na(library.libraries)} />
                <MetricTile label="Games" value={na(library.games)} />
                <MetricTile label="Unmatched" value={na(library.unmatched_folders)} />
                <MetricTile label="Open downloads" value={na(library.download_requests_open)} />
                <MetricTile
                  label="Health"
                  value={formatLibraryHealthValue(library.health)}
                  hint={
                    normalizeLibraryHealth(library.health)?.grade ||
                    formatLibraryHealthHint(library.health)
                  }
                  tone={libraryHealthTone(library.health)}
                />
              </div>
              <LibraryHealthFactors health={library.health} />
            </>
          )}
        </section>

        <section className="gt-ops-panel gt-ops-panel--wide">
          <h2>Scans</h2>
          {!scans ? (
            <p>{snapshot?.scans_error || 'Scan data unavailable.'}</p>
          ) : (scans.jobs || []).length === 0 ? (
            <p className="gt-admin-lede">
              {scans.active_count ?? 0} active
              {scans.queued_count != null ? <> · {scans.queued_count} queued</> : null}
              {' · '}no recent jobs.
            </p>
          ) : (
            <>
              <p className="gt-ops-panel__lede">
                {scans.active_count ?? 0} active
                {scans.queued_count != null ? <> · {scans.queued_count} queued</> : null}
              </p>
              <table className="gt-ops-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Library</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Current</th>
                </tr>
              </thead>
              <tbody>
                {scans.jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <code>#{job.id_short || job.id}</code>
                    </td>
                    <td>{job.library || '—'}</td>
                    <td>{job.status}</td>
                    <td>{formatScanJobCounters(job)}</td>
                    <td className="gt-ops-table__muted">{job.current_processing || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </section>

        <section className="gt-ops-panel gt-ops-panel--wide">
          <h2>Recent errors</h2>
          {(snapshot?.recent_errors || []).length === 0 ? (
            <p className="gt-admin-lede">{snapshot?.recent_errors_error || 'No recent errors.'}</p>
          ) : (
            <table className="gt-ops-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recent_errors.slice(0, 8).map((event) => (
                  <tr key={event.id}>
                    <td>
                      <code>{event.event_type}</code>
                    </td>
                    <td>{event.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Server status, folded in (GT-B21 · UID-015).
          It was a separate page, so "is this box healthy?" meant reading two
          screens and holding them side by side. Ops already owned host meters,
          services, scans and errors; this is the remainder. */}
      {systemDetail ? (
        <div className="gt-ops-console">
          {/* Order is the operator's, and it persists (task #6). Which of these
              matters most depends on what you are chasing — a slow box, a full
              disk, a failing migration — and that is not something a default
              can know. Configuration is here because it was the last thing the
              standalone Server info page showed that Ops did not (W27-D1). */}
          {detailOrder.ids.map((id, index) => (
            <DetailPanel
              key={id}
              title={DETAIL_PANELS[id]}
              values={systemDetail[id]}
              onMove={(delta) => detailOrder.move(id, delta)}
              canMoveUp={index > 0}
              canMoveDown={index < detailOrder.ids.length - 1}
            />
          ))}
          {/* Only once something has been moved — otherwise it is a control
              that does nothing, in chrome this wave spent its time thinning. */}
          {detailOrder.isCustom ? (
            <p className="gt-ops-panel__reset">
              <button type="button" className="gt-cbtn" onClick={detailOrder.reset}>
                Reset panel order
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Recent log, in the console rather than on its own page (W27-D2).
          An error metric is only useful next to the error that produced it.
          This is the recent slice; /admin/system_logs keeps the paginated
          browser with type/level/date filters for deep work, so there are not
          two log browsers to keep in step. */}
      {recentLogs ? (
        <section className="gt-ops-panel gt-ops-panel--wide">
          <h2>Recent log</h2>
          <DataTable
            rows={recentLogs}
            getRowKey={(row) => row.id}
            emptyMessage="No system events recorded yet."
            initialSort={{ key: 'timestamp', dir: 'desc' }}
            dense
            columns={[
              {
                key: 'timestamp',
                label: 'When',
                // Sorts on the ISO string, which orders correctly, while the
                // cell shows local time. Sorting the rendered value would order
                // by whatever the viewer's locale formatting happens to be.
                render: (row) =>
                  row.timestamp ? new Date(row.timestamp).toLocaleString() : '—',
              },
              { key: 'level', label: 'Level' },
              { key: 'type', label: 'Type' },
              { key: 'text', label: 'Event' },
              {
                key: 'user',
                label: 'User',
                render: (row) => row.user || '—',
              },
            ]}
          />
          <p className="gt-admin-lede">
            <a href="/admin/system_logs">Full log — filter by type, level and date</a>
          </p>
        </section>
      ) : null}

      {/* System destinations moved to the rail (GT-B7) — this row repeated
          every entry the rail already lists while the System section is open. */}
    </div>
  )
}
