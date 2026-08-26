/**
 * HTML escaping for the template literals this client builds by hand.
 *
 * Lived as a module-private helper in app.ts, which is how assists.ts came to
 * interpolate server-supplied strings into innerHTML without it — the only such
 * site in the client. Shared here so there is one implementation to import
 * rather than one to remember to copy.
 */
export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
