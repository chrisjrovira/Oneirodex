import { useEffect, useRef, useState } from 'react'
import { setGameStatus, toggleFavorite } from '../api/userActions'
import { coverUrl, DEFAULT_COVER_URL } from '../utils/coverUrl'
import { CoverFallback } from './CoverFallback'
import { safeHttpUrl } from '../utils/safeUrl'
import { platformChipLabels } from '../utils/platformAbbrev'
import { BadgeStack } from './BadgeStack'
import { GameActionBar } from './GameActionBar'
import { GamePreviewPopup } from './GamePreviewPopup'
import { firmwareBlockMessage, isFirmwarePlayBlocked } from '../utils/playHonesty'

const DEFAULT_COVER = DEFAULT_COVER_URL

const STATUS_OPTIONS = [
  { value: 'unplayed', color: '#808080', label: 'Unplayed' },
  { value: 'unfinished', color: '#4A90E2', label: 'Unfinished' },
  { value: 'beaten', color: '#50C878', label: 'Beaten' },
  { value: 'completed', color: '#FFD700', label: 'Completed' },
  { value: 'null', color: '#DC3545', label: "Won't Play" },
  { value: '', color: '#808080', label: 'Clear Status' },
]

const NO_STATUS = {
  value: '',
  color: '#808080',
  label: 'No Status',
}

function statusConfig(status) {
  if (!status) {
    return NO_STATUS
  }
  return STATUS_OPTIONS.find((option) => option.value === status) || NO_STATUS
}

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }

  return document.querySelector('input[name="csrf_token"]')?.value || ''
}

const LONG_PRESS_MS = 480

export function GameCard({
  game,
  showPlayStatus = false,
  isAdmin = false,
  enableDeleteOnDisk = false,
  onToggleFavorite,
  hidePlatformChip = false,
  selectionEnabled = false,
  selected = false,
  onSelectionToggle,
}) {
  const cardRef = useRef(null)
  const longPressTimer = useRef(0)
  const longPressFired = useRef(false)
  const [isFavorite, setIsFavorite] = useState(Boolean(game.is_favorite))
  const [favoritePending, setFavoritePending] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [status, setStatus] = useState(game.user_status || '')
  const [statusPending, setStatusPending] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [imgSrc, setImgSrc] = useState(() => coverUrl(game.cover_url))
  // A cover that never arrives is drawn, not fetched — see CoverFallback.
  const [coverFailed, setCoverFailed] = useState(false)
  const currentStatus = statusConfig(status)
  const igdbUrl = safeHttpUrl(game.url)
  const steamAppId = game.steam_app_id ? Number(game.steam_app_id) : null
  const steamStoreUrl = safeHttpUrl(game.steam_url) || (steamAppId ? `https://store.steampowered.com/app/${steamAppId}` : null)
  const steamRunUrl = steamAppId ? `steam://run/${steamAppId}` : null
  const firmwareBlocked = isFirmwarePlayBlocked(game)
  const playDemoHref =
    firmwareBlocked ? null : game.play_url || game.demo_url || null
  const archiveBlocked = game.play_blocker === 'unsupported_archive'
  const archiveBlockHint =
    game.companion_hint ||
    'This archive type cannot be extracted for browser play. Use .zip / .7z / .rar / ROM.gz or a raw ROM.'
  const firmwareHint = firmwareBlockMessage(game)
  const playBlocked = firmwareBlocked || archiveBlocked
  const playBlockHint = firmwareBlocked ? firmwareHint : archiveBlockHint
  const playBlockLabel = firmwareBlocked
    ? 'firmware missing'
    : 'unsupported archive'
  const platformChip = !hidePlatformChip && game.library_platform ? platformChipLabels(game) : null
  // The placeholder JPG counts as "no cover": rows created before art was
  // fetched carry it as a real `cover_url`, so treating it as an image would
  // put the old baked-in logo back on the tile it was removed from.
  const hasCover = !coverFailed && Boolean(imgSrc) && imgSrc !== DEFAULT_COVER
  useEffect(() => {
    setImgSrc(coverUrl(game.cover_url))
    setCoverFailed(false)
    setIsFavorite(Boolean(game.is_favorite))
    setStatus(game.user_status || '')
    setMenuOpen(false)
    setStatusOpen(false)
  }, [game.uuid, game.cover_url, game.is_favorite, game.user_status])

  useEffect(() => {
    return () => {
      window.clearTimeout(longPressTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen && !statusOpen) {
      return undefined
    }
    const closeMenus = (event) => {
      if (!cardRef.current?.contains(event.target)) {
        setMenuOpen(false)
        setStatusOpen(false)
      }
    }

    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [menuOpen, statusOpen])

  const handleFavoriteClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (favoritePending) {
      return
    }

    setFavoritePending(true)
    try {
      const result = await toggleFavorite(game.uuid)
      setIsFavorite(Boolean(result.is_favorite))
      onToggleFavorite?.(game.uuid, Boolean(result.is_favorite))
    } finally {
      setFavoritePending(false)
    }
  }

  const handleStatusSelect = async (nextStatus) => {
    if (statusPending) {
      return
    }

    setStatusOpen(false)
    setStatusPending(true)
    try {
      const result = await setGameStatus(game.uuid, nextStatus)
      setStatus(result.status || '')
    } finally {
      setStatusPending(false)
    }
  }

  const clearLongPress = () => {
    window.clearTimeout(longPressTimer.current)
    longPressTimer.current = 0
  }

  const handleSelectPointerDown = (event) => {
    if (!selectionEnabled || !onSelectionToggle) {
      return
    }
    if (event.button != null && event.button !== 0) {
      return
    }
    const tag = event.target?.closest?.('button, a, input, select, textarea, label')
    if (tag) {
      return
    }
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      onSelectionToggle(game.uuid, { additive: true, fromLongPress: true })
    }, LONG_PRESS_MS)
  }

  const handleSelectClick = (event) => {
    if (!selectionEnabled || !onSelectionToggle) {
      return
    }
    if (longPressFired.current) {
      event.preventDefault()
      event.stopPropagation()
      longPressFired.current = false
      return
    }
    if (event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      onSelectionToggle(game.uuid, { range: true, shiftKey: true })
    }
  }

  const containerClass = [
    'game-card-container',
    selectionEnabled ? 'is-selectable' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={containerClass}
      ref={cardRef}
      data-selected={selected ? 'true' : 'false'}
      onPointerDown={handleSelectPointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onClickCapture={handleSelectClick}
    >
      <span className="visually-hidden">{game.name}</span>
      <div
        className="game-card"
        // Raises the card above its neighbours while a menu is open.
        //
        // The stacking used to come from `:hover` alone, so the moment the
        // pointer left the tile — which it must, to reach the menu that opens
        // below it — the card dropped back to auto and the next tile in DOM
        // order painted over the menu. On touch there is no hover at all, so
        // the menu was always underneath.
        data-overlay-open={menuOpen || statusOpen ? 'true' : undefined}
        data-name={game.name}
        data-genres={(game.genres || []).join(', ')}
      >
        {selectionEnabled ? (
          <input
            type="checkbox"
            className="gt-tile-select"
            checked={selected}
            aria-label={`Select ${game.name}`}
            onChange={(event) => {
              onSelectionToggle?.(game.uuid, {
                additive: true,
                checked: event.target.checked,
              })
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : null}
        <button
          id={`menuButton-${game.uuid}`}
          type="button"
          className="button-glass-hamburger"
          data-chrome-anchor="top-right"
          aria-label={`Open actions for ${game.name}`}
          aria-expanded={menuOpen}
          aria-controls={`popupMenu-${game.uuid}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setStatusOpen(false)
            setMenuOpen((open) => !open)
          }}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <button
          type="button"
          className={`favorite-btn${isFavorite ? ' favorited' : ''}${favoritePending ? ' processing' : ''}`}
          data-game-uuid={game.uuid}
          data-is-favorite={String(isFavorite)}
          data-chrome-anchor="top-right"
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${game.name} ${isFavorite ? 'from' : 'to'} favorites`}
          aria-pressed={isFavorite}
          disabled={favoritePending}
          onClick={handleFavoriteClick}
        >
          <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span>
        </button>

        {/* Hover affordance — the tile itself opens details, so this is the one
            way to look before committing. Keyboard users get it via focus. */}
        <button
          type="button"
          className="gt-tile-preview-hint"
          aria-label={`Preview ${game.name}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setPreviewOpen(true)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          Preview
        </button>

        {menuOpen && (
          <div id={`popupMenu-${game.uuid}`} className="popup-menu">
            <div className="menu-item menu-item--action-bar">
              <GameActionBar
                gameUuid={game.uuid}
                gameName={game.name}
                variant="compact"
                lifecycleState={game.lifecycle_state || 'not_downloaded'}
                clientConnected={Boolean(game.client_connected)}
              />
            </div>
            {isAdmin && (
              <>
                <div className="menu-item">
                  <a className="menu-button" href={`/game_edit/${game.uuid}`}>
                    Edit Details
                  </a>
                </div>
                <div className="menu-item">
                  <a className="menu-button" href={`/edit_game_images/${game.uuid}`}>
                    Edit Images
                  </a>
                </div>
                <form
                  action={`/refresh_game_images/${game.uuid}`}
                  method="post"
                  className="menu-item"
                >
                  <input type="hidden" name="csrf_token" value={getCsrfToken()} />
                  <button type="submit" className="menu-button refresh-game-images">
                    Refresh Images
                  </button>
                </form>
                <div className="menu-item">
                  <button
                    type="button"
                    className="menu-button delete-game"
                    data-game-uuid={game.uuid}
                  >
                    Remove Game from DB
                  </button>
                </div>
                {enableDeleteOnDisk && (
                  <div className="menu-item">
                    <button
                      type="button"
                      className="menu-button trigger-delete-modal"
                      data-game-uuid={game.uuid}
                    >
                      Delete Game on disk
                    </button>
                  </div>
                )}
                <div className="menu-item move-library-container">
                  <button
                    type="button"
                    className="menu-button move-library"
                    data-game-uuid={game.uuid}
                  >
                    Move Library
                  </button>
                  <div className="submenu-libraries" style={{ display: 'none' }}>
                    <div className="loading-libraries">
                      <span>Loading libraries...</span>
                    </div>
                    <div className="libraries-list" style={{ display: 'none' }} />
                  </div>
                </div>
              </>
            )}
            {igdbUrl && (
              <div className="menu-item">
                <a
                  className="menu-button"
                  href={igdbUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open catalog page
                </a>
              </div>
            )}
            {steamStoreUrl && (
              <div className="menu-item">
                <a
                  className="menu-button"
                  href={steamStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Steam store
                </a>
              </div>
            )}
            {steamRunUrl && (
              <div className="menu-item">
                <a className="menu-button" href={steamRunUrl}>
                  Launch via Steam
                </a>
              </div>
            )}
            {playDemoHref && (
              <div className="menu-item">
                <a className="menu-button" href={playDemoHref}>
                  Play demo
                </a>
              </div>
            )}
          </div>
        )}

        {showPlayStatus && (
          <>
            <button
              type="button"
              className={`game-status-btn${statusPending ? ' processing' : ''}`}
              data-game-uuid={game.uuid}
              data-current-status={status}
              data-chrome-anchor="top-right"
              title={currentStatus.label}
              aria-label={`Game status: ${currentStatus.label}`}
              aria-expanded={statusOpen}
              disabled={statusPending}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setMenuOpen(false)
                setStatusOpen((open) => !open)
              }}
            >
              {statusPending ? (
                <span className="gt-spinner gt-spinner--sm" aria-hidden="true" />
              ) : (
                <span
                  className="gt-status-dot"
                  style={{
                    background: currentStatus.color,
                    opacity: status ? 1 : 0.4,
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
            {statusOpen && (
              <div
                className="status-dropdown"
                data-game-uuid={game.uuid}
                style={{ display: 'block' }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value || 'clear'}
                    type="button"
                    className="status-dropdown-option"
                    data-status={option.value}
                    style={{
                      background: 'none',
                      borderLeft: 0,
                      borderRight: 0,
                      borderTop: option.value ? 0 : '1px solid rgba(255, 255, 255, 0.2)',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleStatusSelect(option.value)
                    }}
                  >
                    <span
                      className="gt-status-dot"
                      style={{ background: option.color, marginRight: '0.45rem' }}
                      aria-hidden="true"
                    />
                    <span className="status-label">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <a href={`/game_details/${game.uuid}`}>
          {/* Nothing to show is drawn, not fetched.
              The old path swapped `src` to default_cover.jpg — a raster with
              the logo and the words baked into it, unreadable below about a
              220px tile and green whatever theme was selected. The fallback
              below is CSS plus the real title, so it scales with the tile and
              follows the theme. Covers that *do* exist are unaffected. */}
          {hasCover ? (
            <img
              key={`${game.uuid}:${imgSrc}`}
              src={imgSrc}
              alt={game.name}
              className="game-cover"
              width={250}
              height={333}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const image = event.currentTarget
                if (image.dataset.fallbackApplied === '1') {
                  return
                }
                image.dataset.fallbackApplied = '1'
                image.removeAttribute('srcset')
                setCoverFailed(true)
              }}
            />
          ) : (
            <CoverFallback name={game.name} />
          )}
        </a>

        {platformChip ? (
          <span className="gt-platform-chip" title={platformChip.full}>
            {platformChip.abbrev}
          </span>
        ) : null}

        {playDemoHref ? (
          <a
            className="gt-tile-play"
            href={playDemoHref}
            title="Play in browser"
            aria-label={`Play ${game.name} in browser`}
            onClick={(event) => event.stopPropagation()}
          >
            Play
          </a>
        ) : playBlocked ? (
          <span
            className="gt-tile-play gt-tile-play--disabled"
            title={playBlockHint}
            aria-disabled="true"
            aria-label={`${game.name}: browser play unavailable — ${playBlockLabel}`}
          >
            Play
          </span>
        ) : null}

        <BadgeStack
          game={game}
          preferredCorner="top-left"
          collidesWithTitle={Boolean(game.badge_title_collision)}
          hasPlatformChip={!hidePlatformChip && Boolean(game.library_platform)}
        />
      </div>

      {previewOpen ? (
        <GamePreviewPopup game={game} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </div>
  )
}
