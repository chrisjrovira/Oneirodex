import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@oneirodex/ui'
import { copyText } from './firmwareModel'

/* FirmwareMissingDialog moved out of EmulatorFirmwarePanel (v11 cycle, H-D.2) — unchanged. */

export function FirmwareMissingDialog({
  open,
  markdown,
  onClose,
}: {
  open: boolean
  markdown: string
  onClose?: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setCopied(false)
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
            Missing firmware
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="od-open-path__close"
            onClick={onClose}
            aria-label="Dismiss missing firmware report"
          >
            ×
          </button>
        </div>
        <p className="od-open-path__reason">
          Markdown you can paste into notes. Oneirodex never downloads BIOS.
        </p>
        <textarea
          className="od-input"
          readOnly
          rows={16}
          value={markdown}
          aria-label="Missing firmware report (markdown)"
        />
        <div className="od-open-path__actions">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              void copyText(markdown)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }}
          >
            Copy markdown
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
        {copied ? <p className="od-open-path__status">Copied to clipboard</p> : null}
      </div>
    </div>
  )
}
