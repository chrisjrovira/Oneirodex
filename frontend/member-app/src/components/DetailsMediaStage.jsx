import { useEffect, useMemo, useState } from 'react'
import './DetailsMediaStage.css'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function embedWithoutAutoplay(src) {
  try {
    const url = new URL(src, window.location.origin)
    url.searchParams.delete('autoplay')
    return `${url.origin}${url.pathname}${url.search}${url.hash}`
  } catch {
    return src
  }
}

function stageItems(videoEmbeds, shownShots) {
  const items = []
  videoEmbeds.forEach((src, index) => {
    items.push({ kind: 'video', src, index, key: `v:${src}` })
  })
  shownShots.forEach((url, index) => {
    items.push({ kind: 'shot', src: url, index, key: `s:${url}` })
  })
  return items
}

/**
 * Compact left-fold media: primary trailer or first shot + thumbs.
 * Theater / Fullscreen expand into the existing lightboxes. Never autoplays.
 */
export function DetailsMediaStage({
  videoEmbeds,
  shownShots,
  onTheater,
  onFullscreen,
  onShotBroken,
}) {
  const items = useMemo(
    () => stageItems(videoEmbeds, shownShots),
    [videoEmbeds, shownShots],
  )
  const [selected, setSelected] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [videoArmed, setVideoArmed] = useState(() => !prefersReducedMotion())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      const reduced = query.matches
      setReducedMotion(reduced)
      if (reduced) {
        setVideoArmed(false)
      }
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (selected >= items.length) {
      setSelected(0)
    }
  }, [items.length, selected])

  if (!items.length) {
    return null
  }

  const current = items[Math.min(selected, items.length - 1)]
  const isVideo = current.kind === 'video'
  const showIframe = isVideo && (videoArmed || !reducedMotion)

  return (
    <div className="gt-details-media">
      <div className="gt-details-media__stage">
        {isVideo && showIframe ? (
          <iframe
            title="Primary trailer"
            src={embedWithoutAutoplay(current.src)}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : null}
        {isVideo && !showIframe ? (
          <button
            type="button"
            className="gt-btn gt-details-media__arm"
            onClick={() => setVideoArmed(true)}
          >
            Play trailer
          </button>
        ) : null}
        {!isVideo ? (
          <button
            type="button"
            className="gt-details-media__still"
            onClick={() => onFullscreen(current.index)}
            aria-label="Open screenshot fullscreen"
          >
            <img
              src={current.src}
              alt=""
              onError={() => onShotBroken(current.src)}
            />
          </button>
        ) : null}
      </div>
      <div className="gt-details-media__bar">
        {items.length > 1 ? (
          <div className="gt-details-media__thumbs">
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`gt-btn gt-details-media__thumb${index === selected ? ' is-active' : ''}`}
                aria-pressed={index === selected}
                aria-label={item.kind === 'video' ? `Show trailer ${item.index + 1}` : `Show screenshot ${item.index + 1}`}
                onClick={() => {
                  setSelected(index)
                  if (item.kind === 'video' && reducedMotion) {
                    setVideoArmed(false)
                  }
                }}
              >
                {item.kind === 'video' ? `Trailer ${item.index + 1}` : (
                  <img src={item.src} alt="" onError={() => onShotBroken(item.src)} />
                )}
              </button>
            ))}
          </div>
        ) : null}
        <div className="gt-details-media__actions">
          {isVideo ? (
            <button
              type="button"
              className="gt-btn"
              onClick={() => onTheater(current.index)}
            >
              Theater
            </button>
          ) : (
            <button
              type="button"
              className="gt-btn"
              onClick={() => onFullscreen(current.index)}
            >
              Fullscreen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
