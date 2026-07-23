export function DeepLinks({ enableServerStatus = false }) {
  return (
    <nav className="ops-deep-links" aria-label="Operations pages">
      <a href="/admin/statistics">Statistics</a>
      <a href="/admin/system_logs">System logs</a>
      <a href="/scan_management">Scan management</a>
      <a href="/admin/manage_downloads">Manage downloads</a>
      {enableServerStatus && <a href="/admin/new_server_info">Server info</a>}
    </nav>
  )
}
