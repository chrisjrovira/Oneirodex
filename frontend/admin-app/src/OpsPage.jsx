import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageStatus } from './PageStatus'

import { DashboardBoard } from './DashboardBoard'
import { DataTable } from './DataTable'
import { OpsLogModal } from './OpsLogModal'
import { defaultOpsLayout, OPS_STORAGE_KEY, opsWidgetMins } from './opsLayout'
import {
  LibraryHealthFactors,
  formatScanJobCounters,
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

// Re-exported: this used to be defined here, and OpsPage.test.jsx imports it
// from this module. Moving the definition without this would have broken a test
// that has nothing to do with the move.
export { formatScanJobCounters }

async function getJson(url, { signal } = {}) {
  const response = await fetch(url, { credentials: 'same-origin', signal })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return response.json()
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

const COMPANION_KIND_COLUMNS = [
  { key: 'kind', label: 'Kind' },
  { key: 'online', label: 'Online', align: 'right' },
  { key: 'registered', label: 'Registered', align: 'right' },
]

const SCAN_JOB_COLUMNS = [
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
      return (
        <span className="od-ops-table__muted">{job.current_processing || '—'}</span>
      )
    },
  },
]

const RECENT_ERROR_COLUMNS = [
  { key: 'event_type', label: 'Type', render: (event) => <code>{event.event_type}</code> },
  { key: 'text', label: 'Message' },
]

/**
 * A key/value block in the Ops console. Board drag replaces ↑↓ reorder.
 */
function DetailPanel({ title, values }) {
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

export function OpsPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  /** Initial mount only — never flash content away on background poll. */
  const [bootLoading, setBootLoading] = useState(true)
  /** Manual Refresh button feedback only. */
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [systemDetail, setSystemDetail] = useState(null)
  const [recentLogs, setRecentLogs] = useState(null)
  const [fullLogOpen, setFullLogOpen] = useState(false)
  const [fullLogEvents, setFullLogEvents] = useState(null)
  const [fullLogLoading, setFullLogLoading] = useState(false)
  const [fullLogError, setFullLogError] = useState(null)
  const requestRef = useRef({ id: 0, controller: null })
  const hasSnapshotRef = useRef(false)

  const openFullLog = useCallback(() => {
    setFullLogOpen(true)
    if (window.location.hash !== '#full-log') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#full-log`)
    }
  }, [])

  const closeFullLog = useCallback(() => {
    setFullLogOpen(false)
    if (window.location.hash === '#full-log') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }, [])

  const loadFullLog = useCallback(() => {
    setFullLogLoading(true)
    setFullLogError(null)
    getJson('/admin/api/ops/logs?limit=200')
      .then((data) => {
        setFullLogEvents(data?.events || [])
        setFullLogLoading(false)
      })
      .catch((err) => {
        setFullLogError(err?.message || 'Unable to load events')
        setFullLogLoading(false)
      })
  }, [])

  const refresh = useCallback((source = 'poll') => {
    const isManual = source === 'manual'
    const isBoot = source === 'boot'
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    if (isManual) setManualRefreshing(true)
    getJson('/admin/api/ops/summary', { signal: controller.signal })
      .then((data) => {
        if (requestRef.current.id !== id || controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
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
        if (!cancelled) setSystemDetail(null)
      })

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
    const tick = () => {
      if (document.hidden) return
      refresh('poll')
    }
    const timer = window.setInterval(tick, 15000)
    const onVis = () => {
      if (!document.hidden) refresh('poll')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
      requestRef.current.controller?.abort()
    }
  }, [refresh])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shouldOpen =
      window.location.hash === '#full-log' || params.get('open') === 'full-log'
    if (shouldOpen) openFullLog()
    const onHash = () => {
      if (window.location.hash === '#full-log') openFullLog()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [openFullLog])

  useEffect(() => {
    if (!fullLogOpen) return undefined
    loadFullLog()
    return undefined
  }, [fullLogOpen, loadFullLog])

  const host = snapshot?.host
  const library = snapshot?.library
  const scans = snapshot?.scans
  const services = snapshot?.services
  const issues = snapshot?.issues
  const severity = issues?.overall || 'good'
  const companions = services?.companions
  const kindRows = companionKindRows(companions?.by_kind)
  const lastSeen = companions?.last_seen

  const presentDetailIds = useMemo(
    () =>
      DETAIL_PANEL_IDS.filter(
        (id) => Object.keys(systemDetail?.[id] || {}).length > 0,
      ),
    [systemDetail],
  )

  const widgets = useMemo(() => {
    const map = {
      status: (
        <OpsStatusBanner
          severity={severity}
          items={issues?.items}
          ariaLabel="System status"
        />
      ),
      'm-cpu': (
        <MetricTile
          label="CPU"
          value={na(host?.cpu?.percent, '%')}
          hint={na(host?.cpu?.cores_logical, ' cores')}
          tone={usageTone(host?.cpu?.percent)}
        />
      ),
      'm-load': (
        <MetricTile label="Load 1/5/15" value={formatLoadAvg(host?.load_avg)} hint="host" />
      ),
      'm-memory': (
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
      ),
      'm-rss': (
        <MetricTile
          label="Process RSS"
          value={formatBytes(host?.process?.rss_bytes)}
          hint={host?.process?.pid != null ? `pid ${host.process.pid}` : 'n/a'}
        />
      ),
      'm-db': (
        <MetricTile
          label="DB ping"
          value={host?.db_ping_ms != null ? `${host.db_ping_ms} ms` : 'n/a'}
          hint="SELECT 1"
          tone={usageTone(host?.db_ping_ms, { warn: 50, bad: 250 })}
        />
      ),
      'm-readyz': (
        <MetricTile
          label="Readyz"
          value={formatReadyz(services?.readyz)}
          hint={na(services?.readyz?.http_status)}
          tone={booleanTone(
            services?.readyz == null ? null : services?.readyz?.http_status === 200,
          )}
        />
      ),
      'm-companions': (
        <MetricTile
          label="Companions"
          value={`${companions?.online ?? 0} / ${companions?.registered ?? 0}`}
          hint={`${lastSeen?.within_1h ?? 0} in 1h · ${lastSeen?.stale ?? 0} stale`}
        />
      ),
      'm-disk': (
        <MetricTile
          label="Games disk"
          value={na(host?.disk_games?.percent ?? host?.disk_base?.percent, '%')}
          hint="volume use"
          tone={usageTone(host?.disk_games?.percent ?? host?.disk_base?.percent)}
        />
      ),
      'm-watch': (
        <MetricTile
          label="Library watch"
          value={formatLibraryWatchStatus(services?.library_watch)}
          hint={
            services?.library_watch?.enabled
              ? `${services.library_watch.roots ?? 0} roots · ${services.library_watch.pending_libraries ?? 0} pending`
              : 'GT_LIBRARY_WATCH off'
          }
        />
      ),
      'm-health': (
        <MetricTile
          label="Library health"
          value={formatLibraryHealthValue(library?.health)}
          hint={formatLibraryHealthHint(library?.health)}
          tone={libraryHealthTone(library?.health)}
        />
      ),
      host: (
        <section className="od-ops-panel od-ops-panel--embedded">
          <h2>Host meters</h2>
          {!host ? (
            <p>{snapshot?.host_error || 'Host data unavailable.'}</p>
          ) : (
            <>
              <p className="od-ops-panel__lede">
                <strong>{host.hostname || 'Unknown host'}</strong>
                {' · '}
                {host.os || 'Unknown OS'} · {host.ip || 'No IP'}
                {' · '}
                up {host.uptime_system || 'n/a'} / app {host.uptime_app || 'n/a'}
              </p>
              <div className="od-ops-meters">
                <MeterBar
                  label="CPU"
                  percent={host.cpu?.percent}
                  detail={
                    host.cpu?.cores_logical != null
                      ? `${host.cpu.cores_logical} logical cores`
                      : null
                  }
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
      ),
      services: (
        <section className="od-ops-panel od-ops-panel--embedded od-ops-panel--services">
          <h2>Services</h2>
          {!services ? (
            <p>{snapshot?.services_error || 'Services data unavailable.'}</p>
          ) : (
            <div className="od-ops-panel__scroll">
              <table className="od-ops-table od-ops-table--services">
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
                            .map(
                              ([k, v]) =>
                                `${k}:${typeof v === 'object' ? v?.status || JSON.stringify(v) : v}`,
                            )
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
                      {services.queues?.scans_active ?? 0} active ·{' '}
                      {services.queues?.scans_pending ?? 0} pending
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
      ),
      companions: (
        <section className="od-ops-panel od-ops-panel--embedded">
          <h2>Companions</h2>
          {!companions ? (
            <p>n/a</p>
          ) : (
            <>
              <p className="od-ops-panel__lede">
                Online {companions.online ?? 0} / {companions.registered ?? 0}
                {' · '}
                window {companions.window_minutes ?? 3}m
                {' · '}
                newest {lastSeen?.newest ? new Date(lastSeen.newest).toLocaleString() : 'n/a'}
                {' · '}
                1h {lastSeen?.within_1h ?? 0} · 24h {lastSeen?.within_24h ?? 0} · stale{' '}
                {lastSeen?.stale ?? 0}
              </p>
              {kindRows.length === 0 ? (
                <p className="od-admin-lede">No registered companions by kind.</p>
              ) : (
                <DataTable
                  columns={COMPANION_KIND_COLUMNS}
                  rows={kindRows}
                  getRowKey={(row) => row.kind}
                  toolbar={false}
                />
              )}
            </>
          )}
        </section>
      ),
      library: (
        <section className="od-ops-panel od-ops-panel--embedded">
          <h2>Library pulse</h2>
          {!library ? (
            <p>{snapshot?.library_error || 'Library data unavailable.'}</p>
          ) : (
            <>
              <div className="od-ops-strip od-ops-strip--compact">
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
      ),
      scans: (
        <section className="od-ops-panel od-ops-panel--embedded od-ops-panel--wide">
          <h2>Scans</h2>
          {!scans ? (
            <p>{snapshot?.scans_error || 'Scan data unavailable.'}</p>
          ) : (scans.jobs || []).length === 0 ? (
            <p className="od-admin-lede">
              {scans.active_count ?? 0} active
              {scans.queued_count != null ? <> · {scans.queued_count} queued</> : null}
              {' · '}no recent jobs.
            </p>
          ) : (
            <>
              <p className="od-ops-panel__lede">
                {scans.active_count ?? 0} active
                {scans.queued_count != null ? <> · {scans.queued_count} queued</> : null}
              </p>
              <DataTable
                columns={SCAN_JOB_COLUMNS}
                rows={scans.jobs}
                getRowKey={(job) => job.id}
                toolbar={false}
              />
            </>
          )}
        </section>
      ),
      errors: (
        <section className="od-ops-panel od-ops-panel--embedded od-ops-panel--wide">
          <h2>Recent errors</h2>
          {(snapshot?.recent_errors || []).length === 0 ? (
            <p className="od-admin-lede">{snapshot?.recent_errors_error || 'No recent errors.'}</p>
          ) : (
            <DataTable
              columns={RECENT_ERROR_COLUMNS}
              rows={snapshot.recent_errors.slice(0, 8)}
              getRowKey={(event) => event.id}
              toolbar={false}
            />
          )}
        </section>
      ),
    }

    for (const id of presentDetailIds) {
      map[`detail-${id}`] = (
        <DetailPanel title={DETAIL_PANELS[id]} values={systemDetail[id]} />
      )
    }

    if (recentLogs) {
      map['recent-log'] = (
        <section className="od-ops-panel od-ops-panel--embedded od-ops-panel--wide">
          <div className="od-ops-panel__head">
            <h2>Recent log</h2>
            <button type="button" className="od-ops-log__full" onClick={openFullLog}>
              Full log — filter by type, level and text
            </button>
          </div>
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
        </section>
      )
    }

    return map
  }, [
    severity,
    issues,
    host,
    services,
    companions,
    lastSeen,
    kindRows,
    library,
    scans,
    snapshot,
    presentDetailIds,
    systemDetail,
    recentLogs,
    openFullLog,
  ])

  const visibleKey = useMemo(
    () =>
      Object.keys(widgets)
        .filter((id) => widgets[id])
        .sort()
        .join('|'),
    [widgets],
  )

  const getDefaultLayout = useCallback(
    () =>
      defaultOpsLayout({
        visibleIds: visibleKey ? visibleKey.split('|') : [],
      }),
    [visibleKey],
  )

  return (
    <div className="od-admin-page od-ops-page">
      <h1 className="od-ops-page__sr-title">Ops</h1>

      <PageStatus
        error={error}
        loading={bootLoading && !snapshot}
        loadingMessage="Loading ops summary…"
      />

      <DashboardBoard
        widgets={widgets}
        storageKey={OPS_STORAGE_KEY}
        defaultLayout={getDefaultLayout}
        minsFn={opsWidgetMins}
        asOf={snapshot?.as_of}
        onRefresh={() => refresh('manual')}
        refreshing={manualRefreshing}
        refreshDisabled={bootLoading}
        layoutLabel="Ops layout"
        statusLabel="Ops controls"
        refreshAriaLabel="Refresh"
        boardAriaLabel="Key metrics"
      />

      <OpsLogModal
        open={fullLogOpen}
        events={fullLogEvents}
        loading={fullLogLoading}
        error={fullLogError}
        onClose={closeFullLog}
        onCleared={() => {
          setFullLogEvents([])
          setRecentLogs([])
          loadFullLog()
        }}
      />
    </div>
  )
}
