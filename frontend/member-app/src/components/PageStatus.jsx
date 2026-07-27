import './PageStatus.css'

/**
 * Shared loading / empty status for weak SPA pages.
 * Loading sets aria-busy; empty uses a polite status region.
 */
export function PageStatus({
  loading = false,
  emptyMessage = null,
  loadingMessage = 'Loading…',
  children = null,
  className = '',
}) {
  if (loading) {
    return (
      <div
        className={`gt-page-status gt-page-status--loading${className ? ` ${className}` : ''}`}
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
