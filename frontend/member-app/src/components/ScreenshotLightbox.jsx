import { useEffect, useId, useState } from 'react'
import './ScreenshotLightbox.css'

/**
 * In-app screenshot viewer — keeps users in the SPA (no new tab).
 */
export function ScreenshotLightbox({ urls = [], openIndex = null, onClose }) {
  const titleId = useId()
  const [index, setIndex] = useState(0)
  const open = openIndex != null && urls.length > 0

  useEffect(() => {
    if (!open) return undefined
    setIndex(openIndex)
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % urls.length)
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + urls.length) % urls.length)
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, openIndex, onClose, urls.length])

  if (!open) return null

  const src = urls[((index % urls.length) + urls.length) % urls.length]

  return (
    <div
      className="gt-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="gt-lightbox__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gt-lightbox__toolbar">
          <h2 id={titleId} className="gt-lightbox__title">
            Screenshot {(((index % urls.length) + urls.length) % urls.length) + 1} / {urls.length}
          </h2>
          <button type="button" className="gt-lightbox__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gt-lightbox__stage">
          {urls.length > 1 ? (
            <button
              type="button"
              className="gt-lightbox__nav"
              onClick={() => setIndex((current) => current - 1)}
              aria-label="Previous"
            >
              ‹
            </button>
          ) : null}
          <img src={src} alt="" className="gt-lightbox__img" />
          {urls.length > 1 ? (
            <button
              type="button"
              className="gt-lightbox__nav"
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
