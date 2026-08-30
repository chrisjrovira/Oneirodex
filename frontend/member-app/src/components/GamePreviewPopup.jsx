import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { fetchGameEditions } from '../api/gameEditions'
import { recordRecentTitle } from '../utils/recentTitles'
import { ExternalStoreLinks } from './ExternalStoreLinks'
import './GamePreviewPopup.css'

/** Fired when a preview opens, so any other open preview closes itself. */
const PREVIEW_OPENED = 'gt-preview-opened'

/**
 * Shortened game detail shown before committing to the full page (UX-B3).
 *
 * Still a summary rather than a second details page — cover, a clamped blurb,
 * the few facts people scan for — with one thing the details page cannot give
 * you either: which *systems* the household holds this title on, and a launcher
 * per emulator core for each of them. The grid shows one tile per library row,
 * so two copies of one game read as two unrelated games; this is the only place
 * they are shown as one title with a choice of how to play it.
 */
/** Shared date shape, so "Released" and "Added" cannot drift apart. */
function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "Added" is the one date people scan for and it was not shown at all. */
export function formatAdded(value) {
  const text = formatDate(value)
  return text ? `Added ${text}` : null
}

/**
 * When the game came out, beside when it arrived here.
 *
 * The facts row asked for `game.first_release_year`, which browse has never
 * sent — so the release fact was silently absent on every tile in the library.
 * The payload carries `first_release_date`; read that, and show the same
 * precision as Added so the pair reads as a pair.
 */
export function formatReleased(game) {
  const text = formatDate(game?.first_release_date)
  if (text) return `Released ${text}`
  const year = game?.first_release_year
  return year ? `Released ${year}` : null
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

/** Facet labels from the editions payload, falling back to browse genres. */
export function mergePreviewTags(gameGenres, editionTags, limit = 8) {
  const labels = []
  const seen = new Set()
  const push = (raw) => {
    const label = typeof raw === 'string' ? raw.trim() : String(raw?.label || '').trim()
    const key = label.toLowerCase()
    if (!label || seen.has(key) || labels.length >= limit) return
    seen.add(key)
    labels.push(label)
  }
  for (const tag of editionTags || []) push(tag)
  for (const genre of gameGenres || []) push(genre)
  return labels
}

/** Household friends who played or favourited a copy — never a store social graph. */
export function friendsSentence(friends) {
  const names = (friends || []).map((row) => String(row?.name || '').trim()).filter(Boolean)
  if (!names.length) return null
  if (names.length === 1) return `${names[0]} in this house`
  if (names.length === 2) return `${names[0]} and ${names[1]} in this house`
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more in this house`
}

/**
 * How the "Available on" heading counts.
 *
 * Distinct *systems*, not rows: two copies of one game in two PC libraries is
 * one system, and a member reading "2 systems" would go looking for a second
 * console. Returns null below two, because "1 systems" next to a list of one is
 * both wrong and pointless.
 */
export function systemCountLabel(editions) {
  const systems = new Set(
    (editions || []).map((row) => row.library_platform).filter(Boolean),
  )
  return systems.size > 1 ? `${systems.size} systems` : null
}

/** Why a copy cannot be launched in the browser, in the member's words. */
export function editionBlockerText(edition) {
  if (!edition || edition.can_play_in_browser) {
    return null
  }
  if (edition.firmware_missing) {
    return edition.companion_hint || 'Needs firmware before it can run here'
  }
  switch (edition.play_blocker) {
    case 'catalog_only':
      return 'Catalog entry — not playable'
    case 'unsupported_archive':
      return edition.companion_hint || 'Archive type cannot be opened for browser play'
    case 'no_browser_core':
      return 'No browser core for this system'
    case 'companion_preferred':
    case 'companion_or_catalog':
      return edition.companion_hint || 'Plays through the desktop companion'
    default:
      return edition.companion_hint || 'Not playable in the browser'
  }
}

export function GamePreviewPopup({ game, reason = '', onClose }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  // `null` while loading; `[]` once we know there is nothing to add. The two
  // are different on screen: a spinner versus no section at all.
  const [editions, setEditions] = useState(null)
  const [editionsFailed, setEditionsFailed] = useState(false)
  // GOG / Epic live on Game.urls, which browse still does not send per tile.
  // Browse may send one `trailer_embed_url` for muted tile hover; the YouTube
  // mark here still rides the editions request so the popup matches details
  // without becoming a second player.
  const [editionUrls, setEditionUrls] = useState([])
  const [editionTags, setEditionTags] = useState([])
  const [editionFriends, setEditionFriends] = useState([])

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

  // Availability across systems — and the store marks browse cannot carry —
  // is a second request on purpose: both are a join the grid has no business
  // repeating for every tile, and the preview is the only surface that asks.
  useEffect(() => {
    const uuid = game?.uuid
    if (!uuid) {
      return undefined
    }
    const controller = new AbortController()
    setEditions(null)
    setEditionsFailed(false)
    setEditionUrls([])
    setEditionTags([])
    setEditionFriends([])
    fetchGameEditions(uuid, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setEditions(data.editions || [])
        setEditionUrls(data.urls || [])
        setEditionTags(Array.isArray(data.tags) ? data.tags : [])
        setEditionFriends(Array.isArray(data.friends) ? data.friends : [])
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          // A failed lookup costs the systems list and nothing else — the
          // preview is still a preview without it. Steam / IGDB from the
          // browse row still render.
          setEditionsFailed(true)
          setEditions([])
          setEditionUrls([])
          setEditionTags([])
          setEditionFriends([])
        }
      })
    return () => controller.abort()
  }, [game?.uuid])

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
    game.is_multi_disc && game.disc_count ? `${game.disc_count} discs` : null,
    // Released then Added, adjacent and in that order: one is about the game,
    // the other about this household's copy of it.
    formatReleased(game),
    formatAdded(game.date_identified || game.date_created),
  ].filter(Boolean)

  const genres = mergePreviewTags(game.genres, editionTags)
  const household = friendsSentence(editionFriends)
  const why = String(reason || game.discover_reason || game.reason || '').trim()
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

            {why ? <p className="gt-preview__reason">{why}</p> : null}

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

            {household ? <p className="gt-preview__friends">{household}</p> : null}

            {game.summary ? (
              <p className="gt-preview__summary">{game.summary}</p>
            ) : (
              <p className="gt-preview__summary gt-preview__summary--empty">
                No summary yet for this title.
              </p>
            )}

            <ExternalStoreLinks
              urls={[...(game.urls || []), ...editionUrls]}
              steamUrl={game.steam_url}
              igdbUrl={game.url_igdb || game.url}
            />

            <div className="gt-preview__actions">
              <Link
                className="gt-btn gt-btn--primary"
                to={`/game_details/${game.uuid}`}
                onClick={() => recordRecentTitle({ uuid: game.uuid, name: game.name })}
              >
                Open details
              </Link>
            </div>
          </div>
        </div>

        <section className="gt-preview__systems" aria-label="Available systems">
          <h3 className="gt-preview__systems-title">
            Available on
            {systemCountLabel(editions) ? (
              <span className="gt-preview__systems-count">
                {systemCountLabel(editions)}
              </span>
            ) : null}
          </h3>

          {editions === null ? (
            <p className="gt-preview__systems-empty">Checking your libraries…</p>
          ) : editions.length === 0 ? (
            <p className="gt-preview__systems-empty">
              {editionsFailed
                ? 'Could not check which systems this is on.'
                : 'Only in this library.'}
            </p>
          ) : (
            <ul className="gt-preview__system-list">
              {editions.map((edition) => {
                const blocker = editionBlockerText(edition)
                return (
                  <li
                    key={edition.uuid}
                    className={`gt-preview__system${
                      edition.is_current ? ' gt-preview__system--current' : ''
                    }`}
                  >
                    <div className="gt-preview__system-head">
                      <span className="gt-preview__system-name">
                        {edition.library_platform_label ||
                          edition.library_platform ||
                          'Unknown system'}
                      </span>
                      {edition.library_name ? (
                        <span className="gt-preview__system-library">
                          {edition.library_name}
                        </span>
                      ) : null}
                      {edition.is_current ? (
                        <span className="gt-preview__system-tag">This copy</span>
                      ) : null}
                      {edition.path_missing ? (
                        <span className="gt-preview__system-tag gt-preview__system-tag--warn">
                          Files missing
                        </span>
                      ) : null}
                    </div>

                    {edition.launchers?.length ? (
                      <div className="gt-preview__launchers">
                        {edition.launchers.map((launcher) => (
                          <a
                            key={`${edition.uuid}:${launcher.core}`}
                            className={`gt-btn gt-btn--secondary gt-preview__launcher${
                              launcher.is_default ? ' is-default' : ''
                            }`}
                            href={launcher.play_url}
                            title={`Play on ${
                              edition.library_platform_label || edition.library_platform
                            } with ${launcher.label}`}
                          >
                            {`Play · ${launcher.label}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="gt-preview__system-note">{blocker}</p>
                    )}

                    {!edition.is_current ? (
                      <Link
                        className="gt-preview__system-link"
                        to={`/game_details/${edition.uuid}`}
                      >
                        Open this copy
                      </Link>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>,
    document.body,
  )
}
