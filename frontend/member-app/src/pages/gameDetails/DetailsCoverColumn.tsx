import { useEffect, useRef, useState } from 'react'
import { BadgeStack } from '../../components/BadgeStack'
import { coverUrl } from '../../utils/coverUrl'
import type { DetailsGame, PathModalRequest, PathRow } from './detailsTypes'

/** Cover art, badge stack and - for admins - the actions menu. */
export function DetailsCoverColumn({
  game,
  pathRows,
  setPathModal,
}: {
  game: DetailsGame
  pathRows: PathRow[]
  setPathModal: (request: PathModalRequest | null) => void
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!adminMenuOpen) return undefined
    function onDocClick(event: MouseEvent) {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [adminMenuOpen])

  return (
    <div
      className={`od-details-page__cover-wrap${adminMenuOpen ? ' od-details-page__cover-wrap--menu-open' : ''}`}
    >
      <img className="od-details-page__cover" src={coverUrl(game.cover_url)} alt="" />
      <BadgeStack game={game} preferredCorner="top-left" maxVisible={2} />
      {game.is_admin ? (
        <div className="od-details-page__admin-menu" ref={adminMenuRef}>
          <button
            type="button"
            className="od-details-page__admin-menu-btn"
            data-chrome-anchor="top-right"
            aria-expanded={adminMenuOpen}
            aria-haspopup="menu"
            aria-controls={adminMenuOpen ? 'od-details-admin-menu' : undefined}
            aria-label="Admin actions"
            onClick={() => setAdminMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">⋮</span>
          </button>
          {adminMenuOpen ? (
            <div
              id="od-details-admin-menu"
              className="od-details-page__admin-menu-panel"
              role="menu"
            >
              <a
                className="od-details-page__admin-menu-item"
                role="menuitem"
                href={`/game_edit/${game.uuid}`}
              >
                Edit Details
              </a>
              <a
                className="od-details-page__admin-menu-item"
                role="menuitem"
                href={`/edit_game_images/${game.uuid}`}
              >
                Edit Images
              </a>
              {pathRows[0] ? (
                <button
                  type="button"
                  className="od-details-page__admin-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setAdminMenuOpen(false)
                    setPathModal(pathRows[0])
                  }}
                >
                  Open path
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
