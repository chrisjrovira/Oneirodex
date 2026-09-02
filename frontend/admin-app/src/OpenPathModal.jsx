import { useEffect, useId, useRef, useState } from 'react'
import { postJson } from './adminApi'
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
 * Unmatched open-path popup — never navigates to Auto Scan.
 */
export function OpenPathModal({ open, path = '', label = 'Path', matchReason = '', onClose }) {
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
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !path) return null

  async function handleCopy() {
    try {
      await copyPath(path)
      setStatus('Path copied to clipboard')
    } catch {
      setStatus('Unable to copy path')
    }
  }

  async function handleOpenExplorer() {
    setBusy(true)
    setStatus(null)
    try {
      await postJson('/api/client/commands', {
        game_uuid: '',
        action: 'open_path',
        path,
        select: true,
      })
      setStatus('Queued open in file explorer for companion')
    } catch (err) {
      try {
        await copyPath(path)
        setStatus(
          err?.message
            ? `${err.message} — path copied as fallback`
            : 'Open failed — path copied as fallback',
        )
      } catch {
        setStatus(err?.message || 'Unable to open or copy path')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="od-open-path"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="od-open-path__panel" onClick={(event) => event.stopPropagation()}>
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
}
