import './PageStatus.css'
import { LoadingMotif } from './LoadingMotif'
import { useLoadingMotifId } from './loadingMotifApi'

/**
 * Read the human sentence out of a failed request (GT-A2).
 *
 * Backend is mid-migration onto the GT-B1 envelope, so this deliberately
 * accepts every legacy shape that still exists in the tree:
 *   { error: 'text' }        — dominant legacy shape
 *   { message: 'text' }      — second legacy shape
 *   { error: { message } }   — defensive; some upstream proxies nest
 *   an Error instance        — thrown by fetch wrappers on network failure
 *
 * Never surfaces a raw status code as the headline; that goes in `detail`.
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
  // Errors are included on purpose: the fetch wrappers throw Error objects that
  // carry `status` / `error_code` off the GT-B1 envelope, and bailing on
  // `instanceof Error` dropped exactly the fields this line exists to show. A
  // plain Error from a network failure has neither, so it still yields null.
  if (!error || typeof error !== 'object') return null
  const parts = []
  if (error.status != null) parts.push(`HTTP ${error.status}`)
  if (typeof error.error_code === 'string' && error.error_code) parts.push(error.error_code)
  return parts.length ? parts.join(' · ') : null
}

/**
 * Shared loading / error / empty status for SPA pages.
 *
 * Precedence is error → loading → empty → children. Error outranks loading so a
 * failed refresh of already-rendered data does not sit spinning forever.
 *
 * Error uses role="alert" (assertive) because it is an interruption the user
 * must act on; loading and empty stay role="status" (polite).
 */
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
  motifId = null,
}) {
  const resolvedMotif = useLoadingMotifId(motifId)

  if (error) {
    const message = errorMessage || resolveErrorMessage(error)
    const detail = resolveErrorDetail(error)
    return (
      <div
        className={`gt-page-status gt-page-status--error${className ? ` ${className}` : ''}`}
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
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <LoadingMotif motifId={resolvedMotif} size="md" title={loadingMessage} />
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
