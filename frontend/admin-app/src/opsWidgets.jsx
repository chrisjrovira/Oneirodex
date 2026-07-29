/**
 * Shared Ops / Dashboard widgets for the observability console.
 * Keep presentation here; pages own fetch / poll cadence.
 */

export function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return 'n/a'
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(Math.abs(n)) / Math.log(1024)), units.length - 1)
  const value = n / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

/** Treat null / undefined as n/a for Grafana-style empty metrics. */
export function na(value, suffix = '') {
  if (value == null || value === '') return 'n/a'
  return suffix ? `${value}${suffix}` : String(value)
}

export function severityLabel(severity) {
  if (severity === 'bad') return 'Action required'
  if (severity === 'warn') return 'Attention needed'
  return 'All systems healthy'
}

export function OpsIssuesList({ items }) {
  const rows = Array.isArray(items) ? items : []
  if (!rows.length) return null
  return (
    <ul className="gt-ops-issues" aria-label="Open issues">
      {rows.map((item) => (
        <li key={item.id || item.message} className={`gt-ops-issues__item gt-ops-issues__item--${item.severity || 'warn'}`}>
          {item.href ? (
            <a href={item.href}>{item.message}</a>
          ) : (
            <span>{item.message}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function OpsStatusBanner({ severity = 'good', asOf, items, ariaLabel = 'System status' }) {
  return (
    <section className={`gt-ops-status gt-ops-status--${severity}`} aria-label={ariaLabel}>
      <div className="gt-ops-status__head">
        <strong>{severityLabel(severity)}</strong>
        {asOf ? <span className="gt-ops-status__asof">Updated {new Date(asOf).toLocaleString()}</span> : null}
      </div>
      <OpsIssuesList items={items} />
    </section>
  )
}

export function MeterBar({ label, percent, detail }) {
  const pct = percent == null || !Number.isFinite(Number(percent)) ? null : Math.max(0, Math.min(100, Number(percent)))
  const tone =
    pct == null ? 'na' : pct >= 95 ? 'bad' : pct >= 85 ? 'warn' : 'good'
  return (
    <div className={`gt-ops-meter gt-ops-meter--${tone}`}>
      <div className="gt-ops-meter__label">
        <span>{label}</span>
        <span>{pct == null ? 'n/a' : `${pct}%`}</span>
      </div>
      <div className="gt-ops-meter__track" aria-hidden="true">
        <div className="gt-ops-meter__fill" style={{ width: pct == null ? '0%' : `${pct}%` }} />
      </div>
      {detail ? <div className="gt-ops-meter__detail">{detail}</div> : null}
    </div>
  )
}

export function MetricTile({ label, value, hint }) {
  return (
    <div className="gt-ops-metric">
      <div className="gt-ops-metric__label">{label}</div>
      <div className="gt-ops-metric__value">{value}</div>
      {hint ? <div className="gt-ops-metric__hint">{hint}</div> : null}
    </div>
  )
}

export function formatLoadAvg(loadAvg) {
  if (!loadAvg || typeof loadAvg !== 'object') return 'n/a'
  const one = loadAvg['1'] ?? loadAvg[1]
  const five = loadAvg['5'] ?? loadAvg[5]
  const fifteen = loadAvg['15'] ?? loadAvg[15]
  if (one == null && five == null && fifteen == null) return 'n/a'
  return `${na(one)} / ${na(five)} / ${na(fifteen)}`
}

export function formatReadyz(readyz) {
  if (!readyz) return 'n/a'
  const status = readyz.status || 'unknown'
  const ms = readyz.check_ms != null ? ` · ${readyz.check_ms}ms` : ''
  return `${status}${ms}`
}

export function companionKindRows(byKind) {
  if (!byKind || typeof byKind !== 'object') return []
  return Object.entries(byKind).map(([kind, counts]) => ({
    kind,
    online: counts?.online ?? 0,
    registered: counts?.registered ?? 0,
  }))
}
