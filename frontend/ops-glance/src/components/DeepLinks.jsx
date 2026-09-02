export function DeepLinks() {
  return (
    <nav className="ops-deep-links" aria-label="Operations pages">
      <a href="/admin/statistics">Statistics</a>
      <a href="/admin/ops?open=full-log">System logs</a>
      <a href="/scan_management">Scan management</a>
      <a href="/admin/manage-downloads">Manage downloads</a>
      {/* The Server info link is gone with the page (W27-D1). It pointed at a
          second rendering of the facts already on this console, and the
          enableServerStatus flag existed only to gate it — a link to yourself
          does not need a feature toggle. */}
    </nav>
  )
}
