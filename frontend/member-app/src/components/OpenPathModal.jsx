import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { queueClientCommand } from '../api/clientCommands'
import { showToast } from '../utils/toast'
import './OpenPathModal.css'

async function copyPath(path) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(path)
    return
  }
  const input = document.createElement('textarea')
  input.value = path
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

/**
 * Path details popup — never navigates to Auto Scan.
 * Queues companion `{ action: 'open_path', path, select: true }`;
 * clipboard fallback only when companion is offline or the queue returns an error.
 */
export function OpenPathModal({
  open,
  path = '',
  label = 'Path',
  gameUuid = '',
  clientConnected = false,
  matchReason = '',
  onClose,
}) {
  const titleId = useId()
  const closeRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    setStatus(null)
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open || !path) return null

  async function handleCopy() {
    try {
      await copyPath(path)
      setStatus('Path copied to clipboard')
      showToast('Path copied to clipboard', 'success')
    } catch {
      setStatus('Unable to copy path')
      showToast('Unable to copy path', 'error')
    }
  }

  async function handleOpenExplorer() {
    setBusy(true)
    setStatus(null)
    try {
      if (clientConnected) {
        await queueClientCommand(gameUuid || '', 'open_path', { path, select: true })
        setStatus('Queued open in file explorer for companion')
        showToast('Queued open in file explorer', 'success')
        return
      }
      await copyPath(path)
      setStatus('Companion offline — path copied. Open it on the host.')
      showToast('Companion offline — path copied', 'info')
    } catch (err) {
      try {
        await copyPath(path)
        setStatus(
          err?.message
            ? `${err.message} — path copied as fallback`
            : 'Open failed — path copied as fallback',
        )
        showToast('Path copied (explorer open unavailable)', 'info')
      } catch {
        setStatus(err?.message || 'Unable to open or copy path')
        showToast(err?.message || 'Unable to open path', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const node = (
    <div
      className="od-open-path"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="od-open-path__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="od-open-path__toolbar">
          <h2 id={titleId} className="od-open-path__title">
            {label}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="od-open-path__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {matchReason ? (
          <p className="od-open-path__reason">
            <strong>Match reason:</strong> {matchReason}
          </p>
        ) : null}
        <p className="od-open-path__path">
          <code>{path}</code>
        </p>
        <div className="od-open-path__actions">
          <button type="button" className="od-btn od-btn--primary" onClick={() => void handleCopy()}>
            Copy path
          </button>
          <button
            type="button"
            className="od-btn"
            disabled={busy}
            onClick={() => void handleOpenExplorer()}
            title={
              clientConnected
                ? 'Ask the desktop companion to reveal this folder'
                : 'Companion offline — copies path instead'
            }
          >
            {busy ? 'Opening…' : 'Open in file explorer'}
          </button>
        </div>
        {status ? (
          <p className="od-open-path__status" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}
