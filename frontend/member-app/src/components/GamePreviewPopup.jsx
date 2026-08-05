import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './GamePreviewPopup.css'

/**
 * Shortened game detail shown before committing to the full page (UX-B3).
 *
 * Deliberately a summary, not a second details page: cover, a clamped blurb,
 * and the few facts people actually scan for. Anything more and it competes
 * with the page it is supposed to preview.
 */
export function GamePreviewPopup({ game, onClose }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!game) {
    return null
  }

  const facts = [
    game.platform_label || game.library_name,
    game.size,
    game.status_label,
    game.rating != null ? `Rating ${Math.round(Number(game.rating))}` : null,
    game.first_release_year || null,
  ].filter(Boolean)

  const genres = Array.isArray(game.genres) ? game.genres.slice(0, 4) : []

  return (
    <div
      className="gt-preview__scrim"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        className="gt-preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${game.name}`}
        ref={panelRef}
      >
        <button
          type="button"
          className="gt-preview__close"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close preview"
        >
          ×
        </button>

        <div className="gt-preview__body">
          {game.cover_url ? (
            <img className="gt-preview__cover" src={game.cover_url} alt="" loading="lazy" />
          ) : null}

          <div className="gt-preview__text">
            <h2 className="gt-preview__title">{game.name}</h2>

            {facts.length ? (
              <p className="gt-preview__facts">
                {facts.map((fact, index) => (
                  <span key={`${fact}-${index}`} className="gt-preview__fact">
                    {fact}
                  </span>
                ))}
              </p>
            ) : null}

            {genres.length ? (
              <p className="gt-preview__genres">{genres.join(' · ')}</p>
            ) : null}

            {game.summary ? (
              <p className="gt-preview__summary">{game.summary}</p>
            ) : (
              <p className="gt-preview__summary gt-preview__summary--empty">
                No summary yet for this title.
              </p>
            )}

            <div className="gt-preview__actions">
              <Link className="gt-btn gt-btn--primary" to={`/game_details/${game.uuid}`}>
                Open details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
