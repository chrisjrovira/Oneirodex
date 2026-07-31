import { useEffect, useId, useRef } from 'react'
import {
  SCAN_CONFLICT_COPY,
  SCAN_QUEUE_POLICY,
} from './scanQueuePolicy'
import './ScanConflictModal.css'

/**
 * Modal when a scan is already running — Queue (default) vs Force parallel.
 */
export function ScanConflictModal({
  open,
  onClose,
  onChoose,
  busy = false,
  title = SCAN_CONFLICT_COPY.title,
  lede = SCAN_CONFLICT_COPY.lede,
}) {
  const titleId = useId()
  const queueRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    queueRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className="gt-scan-conflict"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose?.()
      }}
    >
      <div
        className="gt-scan-conflict__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gt-scan-conflict__toolbar">
          <h2 id={titleId} className="gt-scan-conflict__title">
            {title}
          </h2>
          <button
            type="button"
            className="gt-scan-conflict__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="gt-scan-conflict__lede">{lede}</p>
        <div className="gt-scan-conflict__choices">
          <button
            ref={queueRef}
            type="button"
            className="gt-btn gt-btn--primary gt-scan-conflict__choice"
            disabled={busy}
            onClick={() => onChoose?.(SCAN_QUEUE_POLICY.QUEUE)}
          >
            {SCAN_CONFLICT_COPY.queueLabel}
          </button>
          <p className="gt-scan-conflict__hint">{SCAN_CONFLICT_COPY.queueHint}</p>
          <button
            type="button"
            className="gt-btn gt-scan-conflict__choice gt-scan-conflict__choice--force"
            disabled={busy}
            onClick={() => onChoose?.(SCAN_QUEUE_POLICY.FORCE)}
          >
            {SCAN_CONFLICT_COPY.forceLabel}
          </button>
          <p className="gt-scan-conflict__warn" role="note">
            {SCAN_CONFLICT_COPY.forceWarning}
          </p>
        </div>
        <div className="gt-scan-conflict__actions">
          <button type="button" className="gt-btn" disabled={busy} onClick={onClose}>
            {SCAN_CONFLICT_COPY.cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
