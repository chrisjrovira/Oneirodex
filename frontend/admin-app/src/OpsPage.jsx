import { useCallback, useEffect, useRef, useState } from 'react'
import { HUB_LINKS } from './navConfig'
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

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return '—'
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(Math.abs(n)) / Math.log(1024)), units.length - 1)
  const value = n / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function Meter({ label, value }) {
  if (!value) return null
  return (
    <li>
      {label}: {value.percent ?? '—'}% ({formatBytes(value.used)} / {formatBytes(value.total)})
    </li>
  )
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
  const issues = snapshot?.issues
  const severity = issues?.overall || 'good'

  return (
    <div className="gt-admin-page gt-ops-page">
      <div className="gt-ops-header">
        <div>
          <h1>System · Ops</h1>
          <p className="gt-admin-lede">Live glance for host health, library pulse, and scans.</p>
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

      <section className={`gt-ops-status gt-ops-status--${severity}`} aria-label="System status">
        <strong>
          {severity === 'bad'
            ? 'Action required'
            : severity === 'warn'
              ? 'Attention needed'
              : 'All systems healthy'}
        </strong>
        {snapshot?.as_of ? <span>Updated {new Date(snapshot.as_of).toLocaleString()}</span> : null}
      </section>

      <div className="gt-ops-grid">
        <section className="gt-admin-card">
          <h2>Host</h2>
          {!host ? (
            <p>{snapshot?.host_error || 'Host data unavailable.'}</p>
          ) : (
            <>
              <p>
                <strong>{host.hostname || 'Unknown host'}</strong>
                <br />
                {host.os || 'Unknown OS'} · {host.ip || 'No IP'}
              </p>
              <ul className="gt-ops-list">
                <li>
                  CPU: {host.cpu?.percent ?? '—'}% ({host.cpu?.cores_logical ?? '—'} cores)
                </li>
                <Meter label="Memory" value={host.memory} />
                <Meter label="App disk" value={host.disk_base} />
                <Meter label="Games disk" value={host.disk_games} />
                <li>System uptime: {host.uptime_system || '—'}</li>
                <li>App uptime: {host.uptime_app || '—'}</li>
              </ul>
            </>
          )}
        </section>

        <section className="gt-admin-card">
          <h2>Services</h2>
          {!snapshot?.services ? (
            <p>{snapshot?.services_error || 'Services data unavailable.'}</p>
          ) : (
            <ul className="gt-ops-list">
              <li>
                LiveKit:{' '}
                {snapshot.services.livekit?.configured
                  ? snapshot.services.livekit.reachable === true
                    ? 'reachable'
                    : snapshot.services.livekit.reachable === false
                      ? 'unreachable'
                      : 'configured'
                  : snapshot.services.livekit?.enabled
                    ? 'enabled (missing secrets)'
                    : 'off'}
              </li>
              <li>
                Malware scan:{' '}
                {snapshot.services.malware?.enabled ? 'on' : 'off'}
                {snapshot.services.malware?.enabled
                  ? ` · ClamAV ${
                      snapshot.services.malware.clamav_reachable ? 'up' : 'down (heuristics only)'
                    }`
                  : ''}
              </li>
              <li>
                Companions online: {snapshot.services.companions?.online ?? 0} /{' '}
                {snapshot.services.companions?.registered ?? 0} registered
              </li>
              <li>
                Queues: {snapshot.services.queues?.scans_active ?? 0} scans active ·{' '}
                {snapshot.services.queues?.scans_pending ?? 0} pending ·{' '}
                {snapshot.services.queues?.downloads_open ?? 0} downloads
              </li>
            </ul>
          )}
        </section>

        <section className="gt-admin-card">
          <h2>Library pulse</h2>
          {!library ? (
            <p>{snapshot?.library_error || 'Library data unavailable.'}</p>
          ) : (
            <ul className="gt-ops-list">
              <li>Libraries: {library.libraries ?? 0}</li>
              <li>Games: {library.games ?? 0}</li>
              <li>Unmatched folders: {library.unmatched_folders ?? 0}</li>
              <li>Open downloads: {library.download_requests_open ?? 0}</li>
            </ul>
          )}
        </section>

        <section className="gt-admin-card">
          <h2>Scans</h2>
          {!scans ? (
            <p>{snapshot?.scans_error || 'Scan data unavailable.'}</p>
          ) : (
            <>
              <p>{scans.active_count ?? 0} active</p>
              {(scans.jobs || []).length === 0 ? (
                <p className="gt-admin-lede">No running scan jobs.</p>
              ) : (
                <ul className="gt-ops-list">
                  {scans.jobs.map((job) => (
                    <li key={job.id}>
                      #{job.id} {job.library || 'library'} · {job.status} · {job.progress}%
                      {job.errors ? ` · ${job.errors} errors` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="gt-admin-card">
          <h2>Recent errors</h2>
          {(snapshot?.recent_errors || []).length === 0 ? (
            <p className="gt-admin-lede">{snapshot?.recent_errors_error || 'No recent errors.'}</p>
          ) : (
            <ul className="gt-ops-list">
              {snapshot.recent_errors.slice(0, 6).map((event) => (
                <li key={event.id}>
                  <code>{event.event_type}</code> {event.text}
                </li>
              ))}
            </ul>
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
