import { useCallback, useEffect, useRef, useState } from 'react'
import { HUB_LINKS } from './navConfig'
import {
  MeterBar,
  MetricTile,
  OpsStatusBanner,
  companionKindRows,
  formatBytes,
  formatLoadAvg,
  formatReadyz,
  na,
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

export function OpsPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef({ id: 0, controller: null })

  const refresh = useCallback(() => {
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    setLoading(true)
    getJson('/admin/api/ops/summary')
      .then((data) => {
        if (requestRef.current.id !== id || controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (requestRef.current.id !== id) return
        setError(err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 15000)
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
        <button type="button" className="gt-btn gt-btn--accent" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div role="alert" className="gt-admin-alert">
          Unable to load ops summary ({error.message}).
        </div>
      ) : null}

      <OpsStatusBanner
        severity={severity}
        asOf={snapshot?.as_of}
        items={issues?.items}
        ariaLabel="System status"
      />

      <div className="gt-ops-strip" aria-label="Key metrics">
        <MetricTile label="CPU" value={na(host?.cpu?.percent, '%')} hint={na(host?.cpu?.cores_logical, ' cores')} />
        <MetricTile label="Load 1/5/15" value={formatLoadAvg(host?.load_avg)} hint="host" />
        <MetricTile
          label="Memory"
          value={na(host?.memory?.percent, '%')}
          hint={
            host?.memory
              ? `${formatBytes(host.memory.used)} / ${formatBytes(host.memory.total)}`
              : 'n/a'
          }
        />
        <MetricTile
          label="Process RSS"
          value={formatBytes(host?.process?.rss_bytes)}
          hint={host?.process?.pid != null ? `pid ${host.process.pid}` : 'n/a'}
        />
        <MetricTile label="DB ping" value={host?.db_ping_ms != null ? `${host.db_ping_ms} ms` : 'n/a'} hint="SELECT 1" />
        <MetricTile label="Readyz" value={formatReadyz(services?.readyz)} hint={na(services?.readyz?.http_status)} />
        <MetricTile
          label="Companions"
          value={`${companions?.online ?? 0} / ${companions?.registered ?? 0}`}
          hint={`${lastSeen?.within_1h ?? 0} in 1h · ${lastSeen?.stale ?? 0} stale`}
        />
        <MetricTile
          label="Games disk"
          value={na(host?.disk_games?.percent ?? host?.disk_base?.percent, '%')}
          hint="volume use"
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

        <section className="gt-ops-panel">
          <h2>Services</h2>
          {!services ? (
            <p>{snapshot?.services_error || 'Services data unavailable.'}</p>
          ) : (
            <table className="gt-ops-table">
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
            <div className="gt-ops-strip gt-ops-strip--compact">
              <MetricTile label="Libraries" value={na(library.libraries)} />
              <MetricTile label="Games" value={na(library.games)} />
              <MetricTile label="Unmatched" value={na(library.unmatched_folders)} />
              <MetricTile label="Open downloads" value={na(library.download_requests_open)} />
            </div>
          )}
        </section>

        <section className="gt-ops-panel gt-ops-panel--wide">
          <h2>Scans</h2>
          {!scans ? (
            <p>{snapshot?.scans_error || 'Scan data unavailable.'}</p>
          ) : (scans.jobs || []).length === 0 ? (
            <p className="gt-admin-lede">{scans.active_count ?? 0} active · no recent jobs.</p>
          ) : (
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

      <div className="gt-admin-actions-row">
        {HUB_LINKS.system.map((link) => (
          <a key={link.href} className="gt-btn" href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}
