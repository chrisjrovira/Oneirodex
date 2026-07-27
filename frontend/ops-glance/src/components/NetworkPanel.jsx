import { formatBytes } from '../utils/formatBytes'

export function NetworkPanel({ network }) {
  return (
    <section className="ops-panel">
      <h2>Network</h2>
      {!network ? <p>Network data unavailable.</p> : (
        <ul>
          <li>Sent: {formatBytes(network.bytes_sent)}</li>
          <li>Received: {formatBytes(network.bytes_recv)}</li>
          <li>Packets sent: {network.packets_sent ?? '—'}</li>
          <li>Packets received: {network.packets_recv ?? '—'}</li>
          <li>Connections: {network.connections ?? '—'}</li>
          <li>Errors: {(network.errin ?? 0) + (network.errout ?? 0)}</li>
          <li>Drops: {(network.dropin ?? 0) + (network.dropout ?? 0)}</li>
        </ul>
      )}
    </section>
  )
}
