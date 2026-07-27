import { formatBytes } from '../utils/formatBytes'

function Meter({ label, value }) {
  if (!value) return null
  return <li>{label}: {value.percent ?? '—'}% ({formatBytes(value.used)} / {formatBytes(value.total)})</li>
}

export function HostPanel({ host }) {
  return (
    <section className="ops-panel">
      <h2>Host</h2>
      {!host ? <p>Host data unavailable.</p> : (
        <>
          <strong>{host.hostname ?? 'Unknown host'}</strong>
          <p>{host.os ?? 'Unknown OS'} · {host.ip ?? 'No IP'}</p>
          <ul>
            <li>CPU: {host.cpu?.percent ?? '—'}% ({host.cpu?.cores_logical ?? '—'} logical cores)</li>
            <Meter label="Memory" value={host.memory} />
            <Meter label="Base disk" value={host.disk_base} />
            <Meter label="Games disk" value={host.disk_games} />
            <li>System uptime: {host.uptime_system ?? '—'}</li>
            <li>App uptime: {host.uptime_app ?? '—'}</li>
          </ul>
        </>
      )}
    </section>
  )
}
