import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ScreenshotLightbox.css'

/**
 * In-app screenshot viewer.
 * Double-click image or Fullscreen button uses the browser Fullscreen API.
 *
 * Rendered through a portal to `document.body`. Inline, it inherited whatever
 * stacking its host page imposed — on details, `.od-details-page > :not(…)`
 * lifts every child above the backdrop with `position: relative`, which beat
 * `.od-lightbox`'s `fixed` on specificity and dropped the viewer into the page
 * flow at the foot of the article instead of over it.
 */
export function ScreenshotLightbox({
  urls = [],
  openIndex = null,
  onClose,
}) {
  const titleId = useId()
  const stageRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [fsError, setFsError] = useState(null)
  const items = urls
  const open = openIndex != null && items.length > 0

  useEffect(() => {
    if (!open) return undefined
    setIndex(openIndex)
    setFsError(null)
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % items.length)
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + items.length) % items.length)
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [open, openIndex, onClose, items.length])

  if (!open) return null

  const safeIndex = ((index % items.length) + items.length) % items.length
  const current = items[safeIndex]

  async function enterFullscreen() {
    setFsError(null)
    const node = stageRef.current
    if (!node?.requestFullscreen) {
      setFsError('Fullscreen is not available in this browser')
      return
    }
    try {
      await node.requestFullscreen()
    } catch (err) {
      setFsError(err?.message || 'Unable to enter fullscreen')
    }
  }

  const node = (
    <div
      className="od-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="od-lightbox__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="od-lightbox__toolbar">
          <h2 id={titleId} className="od-lightbox__title">
            Screenshot {safeIndex + 1} / {items.length}
          </h2>
          <div className="od-lightbox__toolbar-actions">
            <button
              type="button"
              className="od-lightbox__fs"
              onClick={() => void enterFullscreen()}
            >
              Fullscreen
            </button>
            <button type="button" className="od-lightbox__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        {fsError ? (
          <p className="od-lightbox__fs-error" role="status">
            {fsError}
          </p>
        ) : null}
        <div className="od-lightbox__stage" ref={stageRef}>
          {items.length > 1 ? (
            <button
              type="button"
              className="od-lightbox__nav"
              onClick={() => setIndex((current) => current - 1)}
              aria-label="Previous"
            >
              ‹
            </button>
          ) : null}
          <img
            src={current}
            alt=""
            className="od-lightbox__img"
            onDoubleClick={() => void enterFullscreen()}
            title="Double-click for fullscreen"
          />
          {items.length > 1 ? (
            <button
              type="button"
              className="od-lightbox__nav"
              onClick={() => setIndex((current) => current + 1)}
              aria-label="Next"
            >
              ›
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}
