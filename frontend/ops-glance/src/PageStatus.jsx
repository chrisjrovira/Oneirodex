/**
 * Shared loading / error / empty status for the Ops glance island (GT-B33).
 *
 * Same API and `.od-page-status` classes as admin-app `PageStatus`. CSS lives
 * on the Jinja Ops shell (`od-primitives.css`), not in this bundle — Docker
 * Node builds this app without the Flask theme tree, so we must not import
 * admin-app. Copied rather than a second visual language.
 *
 * Precedence is error → loading → empty → children. Error outranks loading so
 * a failed refresh of already-rendered data does not sit spinning forever.
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

export function resolveErrorDetail(error) {
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
        className={`od-page-status od-page-status--error${className ? ` ${className}` : ''}`}
        role="alert"
      >
        <div className="od-page-status__body">
          <p className="od-page-status__message">{message}</p>
          {detail ? <p className="od-page-status__detail">{detail}</p> : null}
        </div>
        {onRetry ? (
          <button type="button" className="od-btn od-btn--sm" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`od-page-status od-page-status--loading${className ? ` ${className}` : ''}`}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="od-page-status__message">{loadingMessage}</p>
      </div>
    )
  }

  if (emptyMessage) {
    return (
      <div
        className={`od-page-status od-page-status--empty${className ? ` ${className}` : ''}`}
        role="status"
      >
        <p className="od-page-status__message">{emptyMessage}</p>
        {children}
      </div>
    )
  }

  return children
}
