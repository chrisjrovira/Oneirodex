import { useEffect, useId, useRef, useState } from 'react'
import { queueClientCommand } from '../api/clientCommands'
import { seatCanUseCompanion } from '../utils/seatMode'
import { showToast } from '../utils/toast'
import './OpenPathModal.css'
import { Button, Modal } from '@oneirodex/ui'

async function copyPath(path: any) {
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
}: LooseProps) {
  const titleId = useId()
  const closeRef = useRef<any>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    if (open) setStatus(null)
  }, [open])

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
      // TC-3: a thin seat never queues open-on-companion; the folder is not here.
      if (clientConnected && seatCanUseCompanion()) {
        await queueClientCommand(gameUuid || '', 'open_path', { path, select: true })
        setStatus('Queued open in file explorer for companion')
        showToast('Queued open in file explorer', 'success')
        return
      }
      await copyPath(path)
      if (!seatCanUseCompanion()) {
        setStatus('Path copied — open it on the desktop companion; this seat only browses.')
        showToast('Path copied', 'info')
        return
      }
      setStatus('Companion offline — path copied. Open it on the host.')
      showToast('Companion offline — path copied', 'info')
    } catch (err: any) {
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

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      className="od-open-path"
      panelClassName="od-open-path__panel"
      initialFocusRef={closeRef}
      lockScroll
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
        <Button type="button" variant="primary" onClick={() => void handleCopy()}>
          Copy path
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void handleOpenExplorer()}
          title={
            clientConnected
              ? 'Ask the desktop companion to reveal this folder'
              : 'Companion offline — copies path instead'
          }
        >
          {busy ? 'Opening…' : 'Open in file explorer'}
        </Button>
      </div>
      {status ? (
        <p className="od-open-path__status" role="status">
          {status}
        </p>
      ) : null}
    </Modal>
  )
}
