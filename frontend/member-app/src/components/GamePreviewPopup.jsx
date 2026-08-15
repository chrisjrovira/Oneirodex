import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './GamePreviewPopup.css'

/** Fired when a preview opens, so any other open preview closes itself. */
const PREVIEW_OPENED = 'gt-preview-opened'

/**
 * Shortened game detail shown before committing to the full page (UX-B3).
 *
 * Deliberately a summary, not a second details page: cover, a clamped blurb,
 * and the few facts people actually scan for. Anything more and it competes
 * with the page it is supposed to preview.
 */
/** "Added" is the one date people scan for and it was not shown at all. */
export function formatAdded(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `Added ${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`
}

/**
 * The states that change what you can actually do with a title.
 *
 * All of this already rides along in the browse payload and none of it was
 * surfaced, so the preview could sit next to a tile whose badges said "update
 * available" and repeat none of it. Tone matters: `warn` is for things that
 * stop you playing, not decoration.
 */
export function previewBadges(game) {
  const badges = []
  if (game.path_missing) {
    badges.push({ id: 'missing', label: 'Files missing on disk', tone: 'warn' })
  }
  if (game.lifecycle_state === 'update_available' || game.has_updates) {
    const count = Number(game.updates_count) || 0
    badges.push({ id: 'update', label: count > 1 ? `${count} updates` : 'Update available', tone: 'info' })
  }
  if (game.can_play_in_browser) {
    badges.push({ id: 'play', label: 'Playable in browser', tone: 'good' })
  } else if (game.play_blocker === 'catalog_only') {
    badges.push({ id: 'catalog', label: 'Catalog only', tone: 'muted' })
  }
  if (game.owned || game.store_owned) {
    badges.push({ id: 'owned', label: 'Owned', tone: 'good' })
  }
  if (game.is_vr) {
    badges.push({ id: 'vr', label: 'VR', tone: 'info' })
  }
  const kind = game.item_kind || game.content_kind
  if (kind && kind !== 'game') {
    badges.push({ id: 'kind', label: String(kind).replace(/_/g, ' '), tone: 'muted' })
  }
  return badges
}

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

  // One preview at a time.
  //
  // Every GameCard owns its own popup, so opening a second while a first was up
  // stacked them — two scrims, two dialogs, and `aria-modal` on both. Announcing
  // the open and having every other instance stand down keeps the singleton
  // rule without lifting preview state into the grid, which would make every
  // tile re-render when any one of them was previewed.
  useEffect(() => {
    const token = {}
    const onOther = (event) => {
      if (event.detail !== token) onClose?.()
    }
    window.addEventListener(PREVIEW_OPENED, onOther)
    window.dispatchEvent(new CustomEvent(PREVIEW_OPENED, { detail: token }))
    return () => window.removeEventListener(PREVIEW_OPENED, onOther)
  }, [onClose])

  // The page behind a modal must not scroll — otherwise the wheel moves the
  // grid under a dialog that is meant to have taken over.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  if (!game) {
    return null
  }

  const facts = [
    game.platform_label || game.library_name,
    game.size,
    game.status_label,
    game.rating != null ? `Rating ${Math.round(Number(game.rating))}` : null,
    game.first_release_year || null,
    game.is_multi_disc && game.disc_count ? `${game.disc_count} discs` : null,
    formatAdded(game.date_identified),
  ].filter(Boolean)

  const genres = Array.isArray(game.genres) ? game.genres.slice(0, 6) : []
  const badges = previewBadges(game)

  // Portalled to <body>, not left inside the card.
  //
  // `position: fixed` is relative to the viewport *unless* an ancestor has a
  // transform, filter or containment — and the tiles do, for the hover effect
  // and the virtualiser. Rendered in place, the scrim was therefore positioning
  // against the tile's row, which is why it dimmed one strip of the page
  // instead of the page. A portal puts it outside every one of those ancestors,
  // so `fixed` means fixed.
  return createPortal(
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

            {badges.length ? (
              <p className="gt-preview__badges">
                {badges.map((badge) => (
                  <span
                    key={badge.id}
                    className={`gt-preview__badge gt-preview__badge--${badge.tone}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </p>
            ) : null}

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
    </div>,
    document.body,
  )
}
