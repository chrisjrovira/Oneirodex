import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import './PageStatus.css'
import { LoadingMotif, LOADING_MOTIF_IDS, normalizeLoadingMotifId } from './LoadingMotif'
import { useLoadingMotifId } from './loadingMotifApi'
import { loadingEllipsisFrame, loadingMessageBase } from './loadingStatusText'

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

// Faster animation for visibility during brief loads (user sees motion even in 1-2s loads)
const MOTIF_ROTATE_MS = 400
const ELLIPSIS_MS = 150

function LoadingStatus({
  inline,
  className,
  seedMotif,
  loadingMessage,
}) {
  const base = loadingMessageBase(loadingMessage)
  const [tick, setTick] = useState(0)
  const [motifIndex, setMotifIndex] = useState(0)

  const pool = LOADING_MOTIF_IDS
  const startId = normalizeLoadingMotifId(seedMotif) || pool[0]
  const startIndex = Math.max(0, pool.indexOf(startId))

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduce) return undefined

    const ellipsisTimer = window.setInterval(() => {
      setTick((n) => n + 1)
    }, ELLIPSIS_MS)
    const motifTimer = window.setInterval(() => {
      setMotifIndex((n) => n + 1)
    }, MOTIF_ROTATE_MS)
    return () => {
      window.clearInterval(ellipsisTimer)
      window.clearInterval(motifTimer)
    }
  }, [])

  const motifId = pool[(startIndex + motifIndex) % pool.length]
  const label = `${base}${loadingEllipsisFrame(tick)}`

  return (
    <div
      className={`od-page-status od-page-status--loading${
        inline ? '' : ' od-page-status--takeover'
      }${className ? ` ${className}` : ''}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingMotif
        motifId={motifId}
        size={inline ? 'md' : 'lg'}
        title={label}
      />
      <p className="od-page-status__message">
        <span className="od-page-status__message-base">{base}</span>
        <span className="od-page-status__ellipsis" aria-hidden="true">
          {loadingEllipsisFrame(tick)}
        </span>
      </p>
    </div>
  )
}

/**
 * Shared loading / error / empty status for SPA pages.
 *
 * Precedence is error → loading → empty → children. Error outranks loading so a
 * failed refresh of already-rendered data does not sit spinning forever.
 *
 * Page-level loading is a full-viewport takeover (motif + label). Nested
 * panels pass `inline` so they keep a compact status inside their own frame.
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
  inline = false,
}) {
  const resolvedMotif = useLoadingMotifId(motifId)

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
    const node = (
      <LoadingStatus
        inline={inline}
        className={className}
        seedMotif={resolvedMotif}
        loadingMessage={loadingMessage}
      />
    )
    if (inline || typeof document === 'undefined') return node
    return createPortal(node, document.body)
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
