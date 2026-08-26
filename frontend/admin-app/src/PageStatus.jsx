/**
 * Shared loading / error / empty status for admin pages (GT-B33).
 *
 * The member SPA has had this since GT-A2; admin never did, so fifteen admin
 * files answered "this page is busy" or "this page failed" in at least eight
 * different shapes — `<p>Loading…</p>`, `.gt-admin-alert`,
 * `.gt-admin-lede[role=status]`, `.gt-error`, `.gt-adminpage-status`,
 * `.gt-admin-banner--warn`, bare `<p role="alert">`, and more. The visual
 * inconsistency was the obvious cost; the quieter one was accessibility, since
 * several of those shapes announced a failure politely or not at all.
 *
 * Deliberately the same component API and the same `.gt-page-status` classes as
 * the member version, with the CSS now in the shared theme, so the two halves
 * cannot drift. Copying member's file wholesale was the other option and would
 * have produced a second implementation to keep in step — the thing the GT-A4
 * button work and the UIR-4 rail work both went out of their way to avoid.
 *
 * One deliberate difference: no `LoadingMotif`. The motif system is member-side
 * polish loaded by the member bundle, and an operator waiting on a scan summary
 * is better served by a plain, immediate line than by an animation admin would
 * have to pull in a dependency for.
 *
 * Precedence is error → loading → empty → children. Error outranks loading so a
 * failed refresh of already-rendered data does not sit spinning forever.
 */

/**
 * Read the human sentence out of a failed request.
 *
 * Accepts every shape still present in the tree while the backend finishes
 * migrating onto the GT-B1 envelope:
 *   { error: 'text' }        — dominant legacy shape
 *   { message: 'text' }      — second legacy shape
 *   { error: { message } }   — defensive; some upstream proxies nest
 *   an Error instance        — thrown by adminApi's fetch wrappers
 *
 * Never surfaces a raw status code as the headline; that goes in the detail.
 */
export function resolveErrorMessage(error, fallback = 'Something went wrong.') {
  if (!error) return fallback
  if (typeof error === 'string') return error.trim() || fallback

  if (error instanceof Error) {
    return error.message?.trim() || fallback
  }

  const direct = error.error
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  if (direct && typeof direct === 'object' && typeof direct.message === 'string') {
    if (direct.message.trim()) return direct.message.trim()
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

/** Operator-facing detail line — status code / stable error code, never the headline. */
export function resolveErrorDetail(error) {
  // Errors included on purpose: adminApi's `adminError` throws an Error that
  // carries `status` and `error_code` off the envelope, so bailing on
  // `instanceof Error` would drop exactly the fields this line exists to show.
  // A plain Error from a network failure has neither, so it still yields null.
  if (!error || typeof error !== 'object') return null
  const parts = []
  if (error.status != null) parts.push(`HTTP ${error.status}`)
  if (typeof error.error_code === 'string' && error.error_code) parts.push(error.error_code)
  return parts.length ? parts.join(' · ') : null
}

export function PageStatus({
  loading = false,
  error = null,
  onRetry = null,
  errorMessage = null,
  retryLabel = 'Try again',
  emptyMessage = null,
  loadingMessage = 'Loading…',
  children = null,
  className = '',
}) {
  if (error) {
    const message = errorMessage || resolveErrorMessage(error)
    const detail = resolveErrorDetail(error)
    return (
      <div
        className={`gt-page-status gt-page-status--error${className ? ` ${className}` : ''}`}
        // Assertive: a failure is an interruption the operator has to act on.
        role="alert"
      >
        <div className="gt-page-status__body">
          <p className="gt-page-status__message">{message}</p>
          {detail ? <p className="gt-page-status__detail">{detail}</p> : null}
        </div>
        {onRetry ? (
          <button type="button" className="gt-btn gt-btn--sm" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`gt-page-status gt-page-status--loading${className ? ` ${className}` : ''}`}
        // Polite: progress should not interrupt what the operator is reading.
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="gt-page-status__message">{loadingMessage}</p>
      </div>
    )
  }

  if (emptyMessage) {
    return (
      <div
        className={`gt-page-status gt-page-status--empty${className ? ` ${className}` : ''}`}
        role="status"
      >
        <p className="gt-page-status__message">{emptyMessage}</p>
        {children}
      </div>
    )
  }

  return children
}

export default PageStatus
