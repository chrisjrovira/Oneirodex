import { useEffect, useId, useRef, useState } from 'react'
import './ScreenshotLightbox.css'

/**
 * In-app media viewer — screenshots + video embeds.
 * Double-click image or Fullscreen button uses the browser Fullscreen API.
 */
export function ScreenshotLightbox({
  urls = [],
  openIndex = null,
  onClose,
  videos = [],
  mode = 'screenshots',
}) {
  const titleId = useId()
  const stageRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [fsError, setFsError] = useState(null)
  const isVideo = mode === 'videos'
  const items = isVideo ? videos : urls
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

  return (
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
            {isVideo ? 'Video' : 'Screenshot'} {safeIndex + 1} / {items.length}
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
          {isVideo ? (
            <iframe
              className="od-lightbox__video"
              title={`Game trailer ${safeIndex + 1}`}
              src={current}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <img
              src={current}
              alt=""
              className="od-lightbox__img"
              onDoubleClick={() => void enterFullscreen()}
              title="Double-click for fullscreen"
            />
          )}
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
}
