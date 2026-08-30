import { useEffect, useState } from 'react'
import {
  isDirectVideoUrl,
  mutedHoverTrailerSrc,
  prefersReducedMotion,
} from '../utils/detailsMedia'
import './TileHoverTrailer.css'

/** Delay so scanning the grid does not fire a trailer on every tile. */
export const HOVER_TRAILER_MS = 280

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}

/**
 * Muted cover overlay. The cover stays in the DOM as identity; this is a
 * store-style preview, not Theater. Unmounting on leave is pause + reset.
 */
export function TileHoverTrailer({ src, active }) {
  const reducedMotion = usePrefersReducedMotion()
  if (!src || !active || reducedMotion) {
    return null
  }

  const playSrc = mutedHoverTrailerSrc(src)
  if (!playSrc) {
    return null
  }

  if (isDirectVideoUrl(playSrc)) {
    return (
      <video
        className="gt-tile-hover-trailer"
        src={playSrc}
        muted
        autoPlay
        loop
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />
    )
  }

  return (
    <iframe
      className="gt-tile-hover-trailer"
      src={playSrc}
      title=""
      aria-hidden="true"
      tabIndex={-1}
      allow="autoplay; encrypted-media"
    />
  )
}
