import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  checkGameFreshness,
  cleanupOrphanVersions,
  fetchGameDetails,
  fetchGameVersions,
} from '../api/gameDetails'
import { attachPatchCatalogGuide, searchPatchCatalog } from '../api/patchCatalog'
import { initiateGameDownload } from '../api/downloads'
import { queueClientCommand } from '../api/clientCommands'
import { BadgeStack } from '../components/BadgeStack'
import { CheatsPanel } from '../components/CheatsPanel'
import { PcCheatsPanel } from '../components/PcCheatsPanel'
import { RelatedMediaStrip } from '../components/RelatedMediaStrip'
import { ExternalStoreLinks } from '../components/ExternalStoreLinks'
import { GameActionBar } from '../components/GameActionBar'
import { OpenPathModal } from '../components/OpenPathModal'
import { AddToCollection } from '../components/AddToCollection'
import { PageStatus } from '../components/PageStatus'
import { ScreenshotLightbox } from '../components/ScreenshotLightbox'
import { coverUrl } from '../utils/coverUrl'
import {
  adminPathRows,
  extrasPanelModel,
  formatVersionSize,
  isVersionDownloadable,
  isVersionPathMissing,
  showsRetroarchCheats,
  trailerEmbedUrls,
  youtubeDemoLink,
} from '../utils/detailsMedia'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import { ITEM_KIND_LABEL, resolveItemKind } from '../utils/itemKind'
import {
  FIRMWARE_ADMIN_HREF,
  FIRMWARE_HELP_HREF,
  firmwareBlockHint,
  firmwareBlockMessage,
  honestyApiErrorMessage,
  isFirmwarePlayBlocked,
} from '../utils/playHonesty'
import { showToast } from '../utils/toast'
import './GameDetailsPage.css'

function formatPlaytime(seconds) {
  const total = Number(seconds) || 0
  if (total <= 0) {
    return 'Not played yet'
  }
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours <= 0) {
    return `${minutes}m`
  }
  return `${hours}h ${minutes}m`
}

export function GameDetailsPage() {
  const { gameUuid } = useParams()
  const [game, setGame] = useState(null)
  const [versions, setVersions] = useState([])
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [freshnessBusy, setFreshnessBusy] = useState(false)
  const [freshnessError, setFreshnessError] = useState(null)
  const [busyVersionKey, setBusyVersionKey] = useState(null)
  const [versionActionStatus, setVersionActionStatus] = useState(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [selectedCore, setSelectedCore] = useState('')
  const [catalogHits, setCatalogHits] = useState([])
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState(null)
  const [shotIndex, setShotIndex] = useState(null)
  /* Screenshot URLs the browser could not load.
   *
   * The payload no longer lists art it cannot serve, which fixes the common
   * case. It cannot fix the other one: a remote IGDB URL that has since gone,
   * or a local file deleted after the row was written. Either renders a broken
   * image, and a gallery of broken images is worse than no gallery — so a shot
   * that fails to load leaves the list, and a section left with nothing does
   * not render at all. */
  const [brokenShots, setBrokenShots] = useState(() => new Set())

  const markShotBroken = useCallback((url) => {
    setBrokenShots((current) => {
      if (current.has(url)) return current
      const next = new Set(current)
      next.add(url)
      return next
    })
  }, [])
  const [videoIndex, setVideoIndex] = useState(null)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  // Whether the summary is actually clipped by the 8-line clamp. Measured rather
  // than guessed from character count: a character threshold disagrees with the
  // clamp at both ends — short-but-wrapped text got no toggle, and long text that
  // happened to fit still offered one.
  const summaryRef = useRef(null)
  const [summaryOverflows, setSummaryOverflows] = useState(false)
  const [pathModal, setPathModal] = useState(null)
  const [versionsLoading, setVersionsLoading] = useState(true)
  const adminMenuRef = useRef(null)

  // Re-measure on mount, on summary change, and on resize — a summary that fits
  // on a wide screen can clip on a narrow one.
  useEffect(() => {
    const node = summaryRef.current
    if (!node) {
      return undefined
    }
    if (summaryExpanded) {
      // Expanded, nothing is clipped; keep the toggle so "Show less" survives.
      return undefined
    }
    const measure = () => {
      setSummaryOverflows(node.scrollHeight > node.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [summaryExpanded])

  useEffect(() => {
    if (!gameUuid) {
      return undefined
    }
    const controller = new AbortController()
    let active = true
    setError(null)
    setGame(null)
    setVersionsLoading(true)

    Promise.all([
      fetchGameDetails(gameUuid, { signal: controller.signal }),
      fetchGameVersions(gameUuid, { signal: controller.signal }).catch(() => ({ versions: [] })),
    ])
      .then(([details, versionData]) => {
        if (!active) {
          return
        }
        setGame(details)
        setVersions(Array.isArray(versionData.versions) ? versionData.versions : [])
        setVersionsLoading(false)
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
          setVersionsLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [gameUuid, retryCount])

  useEffect(() => {
    if (game?.emulator_core) {
      setSelectedCore(game.emulator_core)
    }
  }, [game?.emulator_core, game?.uuid])

  useEffect(() => {
    if (!adminMenuOpen) return undefined
    function onDocClick(event) {
      if (!adminMenuRef.current?.contains(event.target)) {
        setAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [adminMenuOpen])

  const videoEmbeds = useMemo(() => trailerEmbedUrls(game), [game])

  /** Screenshots that are actually renderable — see `brokenShots`. */
  const shownShots = useMemo(
    () => (game?.screenshots || []).filter((url) => !brokenShots.has(url)),
    [game?.screenshots, brokenShots],
  )

  const demoLink = useMemo(() => youtubeDemoLink(game), [game])
  const pathRows = useMemo(() => adminPathRows(game), [game])
  const extrasModel = useMemo(
    () => extrasPanelModel(game, versions, { loading: versionsLoading }),
    [game, versions, versionsLoading],
  )
  const baseAndUpdates = useMemo(
    () => versions.filter((row) => row.kind === 'base' || row.kind === 'update'),
    [versions],
  )
  const hasMissingVersions = useMemo(
    () => baseAndUpdates.some((row) => isVersionPathMissing(row)),
    [baseAndUpdates],
  )

  const playHref = useMemo(() => {
    if (!game?.can_play_in_browser || isFirmwarePlayBlocked(game)) {
      return null
    }
    const cores = Array.isArray(game.emulator_cores) ? game.emulator_cores : []
    const core = selectedCore || game.emulator_core || cores[0]
    if (!core || !game.uuid) {
      return game.play_url || null
    }
    const platform = game.library_platform
      ? `&platform=${encodeURIComponent(game.library_platform)}`
      : ''
    const cheatSurface = showsRetroarchCheats(game)
      ? `&cheat_surface=${encodeURIComponent('retroarch')}`
      : ''
    return `/static/vendor/webretro/webretro.html?guid=${encodeURIComponent(game.uuid)}&core=${encodeURIComponent(core)}${platform}${cheatSurface}`
  }, [game, selectedCore])

  const firmwareBlocked = isFirmwarePlayBlocked(game)
  const firmwareMessage = firmwareBlocked ? firmwareBlockMessage(game) : null
  const firmwareHint = firmwareBlocked ? firmwareBlockHint(game) : null

  async function handleVersionDownload({ kind = 'base', versionUuid, label }) {
    if (!game?.uuid || busyVersionKey) {
      return
    }
    const versionKey = `download:${kind}:${versionUuid || 'base'}`
    setBusyVersionKey(versionKey)
    setVersionActionStatus(null)
    try {
      await initiateGameDownload(game.uuid, { kind, versionUuid })
      setVersionActionStatus(`${label || 'Download'} ready - opening Downloads`)
      showToast(`${label || 'Download'} ready - opening Downloads`, 'success')
      window.location.assign('/downloads')
    } catch (err) {
      const message = honestyApiErrorMessage(err, 'Download failed')
      setVersionActionStatus(message)
      showToast(message, 'error')
    } finally {
      setBusyVersionKey(null)
    }
  }

  async function handleFreshnessCheck() {
    if (!gameUuid || freshnessBusy) {
      return
    }
    setFreshnessBusy(true)
    setFreshnessError(null)
    try {
      const result = await checkGameFreshness(gameUuid)
      setGame((prev) =>
        prev
          ? {
              ...prev,
              freshness_status: result.status || prev.freshness_status,
              freshness_confidence: result.confidence ?? prev.freshness_confidence,
            }
          : prev,
      )
    } catch (err) {
      setFreshnessError(err)
      showToast(err?.message || 'Freshness check failed', 'error')
    } finally {
      setFreshnessBusy(false)
    }
  }

  async function handleCleanupOrphans() {
    if (!gameUuid || cleanupBusy || !game?.is_admin) {
      return
    }
    setCleanupBusy(true)
    setVersionActionStatus(null)
    try {
      const result = await cleanupOrphanVersions(gameUuid)
      const removed =
        Number(result.removed ?? result.removed_count ?? result.count ?? 0) || 0
      const message =
        result.message ||
        (removed > 0
          ? `Removed ${removed} missing version${removed === 1 ? '' : 's'}`
          : 'No missing versions to remove')
      setVersionActionStatus(message)
      showToast(message, 'success')
      const versionData = await fetchGameVersions(gameUuid).catch(() => ({ versions: [] }))
      setVersions(Array.isArray(versionData.versions) ? versionData.versions : [])
    } catch (err) {
      const message =
        err?.status === 404
          ? 'Orphan cleanup is not available on this server yet'
          : err?.message || 'Failed to remove missing versions'
      setVersionActionStatus(message)
      showToast(message, err?.status === 404 ? 'info' : 'error')
    } finally {
      setCleanupBusy(false)
    }
  }

  if (!game) {
    return (
      <div className="gt-more-page gt-details-page">
        <PageStatus
          loading={!error}
          error={error}
          errorMessage="Unable to load game details."
          loadingMessage="Loading game…"
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      </div>
    )
  }

  const itemKind = resolveItemKind(game)

  return (
    <div className="gt-more-page gt-details-page">
      {/* Wide, title-free art behind the page.
          Two rules make this work as atmosphere rather than as a picture the
          content is sitting on top of: it is never the cover (the cover carries
          the title, and the title is already on the page in readable type), and
          it is obscured on three axes at once — blurred, desaturated, and faded
          out under a gradient that reaches full opacity well before the text
          starts. Aria-hidden and `pointer-events: none` because it is a surface,
          not content: nothing here is announced and nothing here is clickable.
          Absent when a title has no wide art, which leaves the page on its flat
          surface exactly as before. */}
      {game.backdrop_url ? (
        <div className="gt-details-page__backdrop" aria-hidden="true">
          <img src={game.backdrop_url} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="gt-details-page__nav">
        <Link className="gt-btn" to="/library">
          ← Library
        </Link>
        {game.library_platform ? (
          <Link
            className="gt-btn"
            to={`/library?library_platform=${encodeURIComponent(game.library_platform)}`}
          >
            {game.library_platform_label || game.library_platform}
          </Link>
        ) : null}
      </div>

      <div className="gt-details-page__hero">
        <div
          className={`gt-details-page__cover-wrap${adminMenuOpen ? ' gt-details-page__cover-wrap--menu-open' : ''}`}
        >
          <img
            className="gt-details-page__cover"
            src={coverUrl(game.cover_url)}
            alt=""
          />
          <BadgeStack game={game} preferredCorner="top-left" maxVisible={2} />
          {game.is_admin ? (
            <div className="gt-details-page__admin-menu" ref={adminMenuRef}>
              <button
                type="button"
                className="gt-details-page__admin-menu-btn"
                data-chrome-anchor="top-right"
                aria-expanded={adminMenuOpen}
                aria-haspopup="menu"
                aria-controls={adminMenuOpen ? 'gt-details-admin-menu' : undefined}
                aria-label="Admin actions"
                onClick={() => setAdminMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">⋮</span>
              </button>
              {adminMenuOpen ? (
                <div
                  id="gt-details-admin-menu"
                  className="gt-details-page__admin-menu-panel"
                  role="menu"
                >
                  <a
                    className="gt-details-page__admin-menu-item"
                    role="menuitem"
                    href={`/game_edit/${game.uuid}`}
                  >
                    Edit Details
                  </a>
                  <a
                    className="gt-details-page__admin-menu-item"
                    role="menuitem"
                    href={`/edit_game_images/${game.uuid}`}
                  >
                    Edit Images
                  </a>
                  {pathRows[0] ? (
                    <button
                      type="button"
                      className="gt-details-page__admin-menu-item"
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
        <div className="gt-details-page__hero-main">
          <h1>{game.name}</h1>
          <p className="gt-details-page__meta-line">
            {[
              game.developer,
              game.publisher,
              game.category,
              game.first_release_date
                ? formatLocaleDate(game.first_release_date, { fallback: null })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="gt-details-page__chips">
            {itemKind !== 'game' ? (
              <span
                className="chip gt-chip"
                title="Library item kind - gaming software, not a main-game catalog match"
              >
                {ITEM_KIND_LABEL[itemKind]}
              </span>
            ) : null}
            {game.local_version ? (
              <span className="chip gt-chip" title="Installed / library version">
                Version {game.local_version}
              </span>
            ) : null}
            {game.remote_version_summary ? (
              <span className="chip gt-chip" title="Remote / store version summary">
                Remote {game.remote_version_summary}
              </span>
            ) : null}
            {game.size ? <span className="chip gt-chip">{game.size}</span> : null}
            {game.status_label ? <span className="chip gt-chip">{game.status_label}</span> : null}
            {game.rom_region || game.rom_languages ? (
              <span className="chip gt-chip" title="ROM region / languages from filename">
                {[game.rom_region, game.rom_languages].filter(Boolean).join(' · ') || 'ROM lang'}
                {game.preferred_locale_matches === true
                  ? ` · matches ${game.preferred_game_locale || 'en-US'}`
                  : null}
                {game.preferred_locale_matches === false
                  ? ` · no ${game.preferred_game_locale || 'en-US'}`
                  : null}
                {game.has_english === false ? ' · no EN' : null}
              </span>
            ) : null}
            {game.freshness_status ? (
              <span className="chip gt-chip">Freshness: {game.freshness_status}</span>
            ) : null}
            {/* Companion presence reads as status, so it belongs on the status
                row rather than floating above the action buttons. */}
            <span
              className={`chip gt-chip${game.client_connected ? '' : ' gt-chip--muted'}`}
              title={
                game.client_connected
                  ? 'Companion client is online'
                  : 'Companion client offline — install/update/uninstall need it'
              }
            >
              {game.client_connected ? 'Companion online' : 'Companion offline'}
            </span>
            {game.hltb_main_story != null ? (
              <span className="chip gt-chip">HLTB main {Number(game.hltb_main_story).toFixed(1)}h</span>
            ) : null}
            {game.is_favorite ? <span className="chip gt-chip">Favorite</span> : null}
          </div>
          <GameActionBar
            gameUuid={game.uuid}
            gameName={game.name}
            lifecycleState={game.lifecycle_state || 'not_downloaded'}
            clientConnected={Boolean(game.client_connected)}
            variant="full"
            showPresence={false}
          />
          <div className="gt-details-page__quick">
            {playHref ? (
              <>
                {Array.isArray(game.emulator_cores) && game.emulator_cores.length > 1 ? (
                  <label className="gt-details-page__core-picker">
                    Core{' '}
                    <select
                      value={selectedCore || game.emulator_core || game.emulator_cores[0]}
                      onChange={(event) => setSelectedCore(event.target.value)}
                    >
                      {game.emulator_cores.map((core) => (
                        <option key={core} value={core}>
                          {core}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <a className="gt-btn gt-btn--primary" href={playHref}>
                  Play in browser
                </a>
              </>
            ) : firmwareBlocked || game.play_blocker === 'unsupported_archive' ? (
              <button
                type="button"
                className="gt-btn gt-btn--primary"
                disabled
                title={
                  firmwareBlocked
                    ? firmwareMessage
                    : game.companion_hint ||
                      'This archive type cannot be extracted for browser play. Use .zip / .7z / .rar / ROM.gz or a raw ROM.'
                }
              >
                Play in browser
              </button>
            ) : null}
            {/* Same control as the tile menu's, at the other place the "where
                does this go" decision gets made. */}
            <AddToCollection
              gameUuid={game.uuid}
              gameName={game.name}
              variant="inline"
            />
            <ExternalStoreLinks
              urls={game.urls}
              steamUrl={game.steam_url}
              igdbUrl={game.url_igdb || game.url}
            />
            {/* Launch Steam sits second-to-last, immediately before the
                freshness check.
                It used to lead the row, right after Play in browser — two
                "start the game" buttons side by side, one of which only works
                if you own it on Steam and have the client installed. Grouped
                with the store links instead, it reads as the last of the
                "elsewhere" actions, which is what it is: the row now runs
                play → where else this exists → launch it there → go and look
                for changes. */}
            {game.steam_app_id ? (
              <a className="gt-btn" href={`steam://run/${game.steam_app_id}`}>
                Launch Steam
              </a>
            ) : null}
            <button
              type="button"
              className="gt-btn"
              disabled={freshnessBusy}
              title="Re-read the store listing for a newer version, updates, or DLC"
              onClick={() => {
                void handleFreshnessCheck()
              }}
            >
              {/* "Check stores" read like a store-availability lookup; it actually
                  re-reads the listing for updates/DLC. */}
              {freshnessBusy ? 'Checking…' : 'Check updates & DLC'}
            </button>
          </div>
          {firmwareBlocked ? (
            <p className="gt-details-page__play-honesty" role="status">
              <span>{firmwareMessage}</span>
              {firmwareHint ? (
                <span className="gt-details-page__muted"> {firmwareHint}</span>
              ) : null}{' '}
              <Link to={FIRMWARE_HELP_HREF}>Help → Browser play</Link>
              {game.is_admin ? (
                <>
                  {' '}
                  ·{' '}
                  <a href={FIRMWARE_ADMIN_HREF}>Admin → Emulators</a>
                </>
              ) : null}
            </p>
          ) : null}
          {freshnessError ? (
            <p className="gt-details-page__muted" role="alert">
              Update check failed: {String(freshnessError.message || freshnessError)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="gt-details-page__content-grid">
        {game.summary ? (
          <section className="gt-details-page__section gt-details-page__section--summary">
            <h2>Summary</h2>
            <p
              ref={summaryRef}
              className={`gt-details-page__summary${summaryExpanded ? ' is-expanded' : ''}`}
            >
              {game.summary}
            </p>
            {summaryOverflows ? (
              <button
                type="button"
                className="gt-btn gt-details-page__summary-toggle"
                onClick={() => setSummaryExpanded((open) => !open)}
              >
                {summaryExpanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="gt-details-page__section gt-details-page__section--facts">
          <h2>Details</h2>
          {pathRows.length > 0 ? (
            <div className="gt-details-page__paths" aria-label="Admin paths">
              {pathRows.map((row) => (
                <div key={`${row.label}-${row.path}`} className="gt-details-page__path-row">
                  <span className="gt-details-page__path-label">{row.label}</span>
                  <code className="gt-details-page__path-value" title={row.path}>
                    {row.path}
                  </code>
                  <button
                    type="button"
                    className="gt-btn"
                    onClick={() => setPathModal(row)}
                  >
                    Open path
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <dl className="gt-details-page__facts">
            {game.rating != null ? (
              <>
                <dt>Rating</dt>
                <dd>
                  {Number(game.rating).toFixed(0)}
                  {game.rating_count ? ` (${game.rating_count})` : ''}
                </dd>
              </>
            ) : null}
            {game.genres?.length ? (
              <>
                <dt>Genres</dt>
                <dd>
                  {game.genres.map((name) => (
                    <Link
                      key={name}
                      className="chip gt-chip"
                      to={`/library?genre=${encodeURIComponent(name)}`}
                    >
                      {name}
                    </Link>
                  ))}
                </dd>
              </>
            ) : null}
            {game.themes?.length ? (
              <>
                <dt>Themes</dt>
                <dd>{game.themes.join(', ')}</dd>
              </>
            ) : null}
            {game.platforms?.length ? (
              <>
                <dt>IGDB platforms</dt>
                <dd>{game.platforms.join(', ')}</dd>
              </>
            ) : null}
            {game.game_modes?.length ? (
              <>
                <dt>Modes</dt>
                <dd>{game.game_modes.join(', ')}</dd>
              </>
            ) : null}
            <dt>Playtime</dt>
            <dd>
              {formatPlaytime(game.playtime?.total_seconds)}
              {game.playtime?.session_count
                ? ` · ${game.playtime.session_count} session${game.playtime.session_count === 1 ? '' : 's'}`
                : ''}
            </dd>
            {game.times_downloaded != null ? (
              <>
                <dt>Downloads</dt>
                <dd>{game.times_downloaded}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      {game.show_translations_block ? (
        <section className="gt-details-page__section" id="translations">
          <h2>Translations &amp; patches</h2>
          <p className="gt-details-page__muted">
            {game.needs_translation
              ? `This ROM may not match your preferred game language (${game.preferred_game_locale || 'en-US'}).`
              : 'Translation patches available for this title.'}{' '}
            Always keep a backup of the original ROM. See the in-app{' '}
            <Link to="/help#translations">Help → Translations</Link> guide
            {' '}or <code>docs/user/translation-patches.md</code>.
          </p>
          {Array.isArray(game.translation_patches) && game.translation_patches.length > 0 ? (
            <ul className="gt-details-page__versions">
              {game.translation_patches.map((patch) => {
                const versionKey = `patch:${patch.uuid}`
                const applyBusy = busyVersionKey === versionKey
                const canApplyPatch =
                  Boolean(game.client_connected) &&
                  Boolean(game.rom_patch_apply_enabled)
                return (
                  <li key={patch.uuid}>
                    <div className="gt-details-page__version-row">
                      <div>
                        <strong>{patch.label}</strong>
                        <span className="gt-details-page__muted">
                          {' '}
                          · {(patch.patch_format || 'patch').toUpperCase()}
                          {patch.target_language ? ` · → ${patch.target_language}` : ''}
                        </span>
                      </div>
                      <div className="gt-details-page__version-actions">
                        <a className="gt-btn" href={patch.download_url}>
                          Download patch
                        </a>
                        {patch.source_url ? (
                          <a
                            className="gt-btn"
                            href={patch.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Guide
                          </a>
                        ) : null}
                        {canApplyPatch ? (
                          <button
                            type="button"
                            className="gt-btn"
                            disabled={Boolean(busyVersionKey)}
                            onClick={() => {
                              setBusyVersionKey(versionKey)
                              setVersionActionStatus(null)
                              void queueClientCommand(game.uuid, 'apply_patch', {
                                kind: 'extra',
                                versionUuid: patch.uuid,
                              })
                                .then(() => {
                                  setVersionActionStatus(`${patch.label} queued for companion apply`)
                                  showToast(`${patch.label} queued for companion apply`, 'success')
                                })
                                .catch((err) => {
                                  setVersionActionStatus(err?.message || 'Failed to queue apply')
                                  showToast(err?.message || 'Queue failed', 'error')
                                })
                                .finally(() => {
                                  setBusyVersionKey(null)
                                })
                            }}
                          >
                            {applyBusy ? 'Queuing…' : 'Apply with companion'}
                          </button>
                        ) : (
                          <Link className="gt-btn" to="/help#translations">
                            How to apply
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="gt-details-page__muted">
              No patch files in extras yet. Ask a librarian to add a curated{' '}
              <code>.ips</code>/<code>.bps</code>/<code>.ups</code> under the game extras folder,
              or follow the how-to for applying a patch you already have.
            </p>
          )}
          {game.rom_ai_translate?.show_panel ? (
            <div className="gt-details-page__ai-translate">
              <h3>Live translate (RetroArch AI)</h3>
              <p className="gt-details-page__muted">
                {game.rom_ai_translate.note}{' '}
                Target language hint: <code>{game.rom_ai_translate.target_lang || 'en'}</code>
                {game.rom_ai_translate.service_url_hint
                  ? ` · service ${game.rom_ai_translate.service_url_hint}`
                  : ''}
                . Offline dump→rebuild is not available for this system yet.
              </p>
              <Link className="gt-btn" to="/help#translations">
                Setup guide
              </Link>
            </div>
          ) : null}
          {game.is_admin && game.patch_catalog_enabled ? (
            <div className="gt-details-page__catalog">
              <h3>Operator catalog</h3>
              <p className="gt-details-page__muted">
                Search your local YAML/JSON patch guide catalog (metadata only - no third-party scrape).
              </p>
              <button
                type="button"
                className="gt-btn"
                disabled={catalogBusy}
                onClick={() => {
                  setCatalogBusy(true)
                  setCatalogStatus(null)
                  void searchPatchCatalog({ gameUuid: game.uuid })
                    .then((data) => {
                      setCatalogHits(Array.isArray(data.hits) ? data.hits : [])
                      setCatalogStatus(
                        data.hits?.length
                          ? `${data.hits.length} hit(s)`
                          : 'No catalog matches',
                      )
                    })
                    .catch((err) => {
                      setCatalogHits([])
                      setCatalogStatus(err?.message || 'Catalog search failed')
                    })
                    .finally(() => {
                      setCatalogBusy(false)
                    })
                }}
              >
                {catalogBusy ? 'Searching…' : 'Search catalog'}
              </button>
              {catalogStatus ? (
                <p className="gt-details-page__muted" role="status">
                  {catalogStatus}
                </p>
              ) : null}
              {catalogHits.length > 0 ? (
                <ul className="gt-details-page__versions">
                  {catalogHits.map((hit) => (
                    <li key={hit.id}>
                      <div className="gt-details-page__version-row">
                        <div>
                          <strong>{hit.title}</strong>
                          <span className="gt-details-page__muted">
                            {' '}
                            · {hit.provider}
                            {hit.patch_format ? ` · ${hit.patch_format}` : ''}
                            {hit.target_language ? ` · → ${hit.target_language}` : ''}
                          </span>
                          {hit.notes ? (
                            <p className="gt-details-page__muted">{hit.notes}</p>
                          ) : null}
                        </div>
                        <div className="gt-details-page__version-actions">
                          {hit.source_url ? (
                            <a
                              className="gt-btn"
                              href={hit.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open guide
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="gt-btn"
                            disabled={catalogBusy}
                            onClick={() => {
                              setCatalogBusy(true)
                              void attachPatchCatalogGuide({
                                game_uuid: game.uuid,
                                source_url: hit.source_url,
                                notes: hit.notes,
                                target_language: hit.target_language,
                                patch_format: hit.patch_format,
                              })
                                .then(() => {
                                  setCatalogStatus('Guide attached to game')
                                  showToast('Guide attached', 'success')
                                  setRetryCount((n) => n + 1)
                                })
                                .catch((err) => {
                                  setCatalogStatus(err?.message || 'Attach failed')
                                })
                                .finally(() => {
                                  setCatalogBusy(false)
                                })
                            }}
                          >
                            Attach guide
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {baseAndUpdates.length > 0 ? (
        <section className="gt-details-page__section" id="updates">
          <div className="gt-details-page__section-head">
            <h2>Versions</h2>
            {game.is_admin ? (
              <button
                type="button"
                className="gt-btn gt-btn--secondary"
                disabled={cleanupBusy}
                onClick={() => void handleCleanupOrphans()}
                title={
                  hasMissingVersions
                    ? 'Remove version rows whose files are missing on disk'
                    : 'Scan and remove orphaned version rows'
                }
              >
                {cleanupBusy ? 'Removing…' : 'Remove missing versions'}
              </button>
            ) : null}
          </div>
          {versionActionStatus ? (
            <p className="gt-details-page__muted" role="status">
              {versionActionStatus}
            </p>
          ) : null}
          <ul className="gt-details-page__versions">
            {baseAndUpdates.map((row) => {
              const versionKey = `${row.kind}:${row.uuid}`
              const downloadKey = `download:${row.kind}:${row.uuid || 'base'}`
              const canDownload = isVersionDownloadable(row)
              const pathMissing = isVersionPathMissing(row)
              const sizeLabel = formatVersionSize(row.size)
              const canApply =
                Boolean(game.client_connected) && row.kind === 'update' && canDownload
              const applyBusy = busyVersionKey === versionKey
              const downloadBusy = busyVersionKey === downloadKey
              return (
                <li key={`${row.kind}-${row.id || row.uuid}`}>
                  <div className="gt-details-page__version-row">
                    <div className="gt-details-page__version-meta">
                      <strong>{row.label}</strong>
                      {row.is_default ? (
                        <span className="chip gt-chip" title="Default download version">
                          Default
                        </span>
                      ) : null}
                      <span className="gt-details-page__muted">
                        {' '}
                        · {row.kind}
                        {sizeLabel ? ` · ${sizeLabel}` : ''}
                      </span>
                      {pathMissing ? (
                        <span className="gt-details-page__muted gt-details-page__version-missing">
                          {' '}
                          · Missing on disk
                        </span>
                      ) : null}
                    </div>
                    <div className="gt-details-page__version-actions">
                      {/* Updates get a Download; the base row does not.
                          Downloading the base game is what the action bar at
                          the top of the page is for, and it is the *primary*
                          action there — so this row was a second, quieter copy
                          of the page's loudest button, sitting under a heading
                          about versions. Per-update download stays, because
                          that is the one thing the action bar genuinely cannot
                          express: "I have the game, I only need patch 1.03". */}
                      {canDownload && row.kind === 'update' ? (
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={Boolean(busyVersionKey)}
                          onClick={() => {
                            void handleVersionDownload({
                              kind: 'update',
                              versionUuid: row.uuid,
                              label: row.label,
                            })
                          }}
                        >
                          {downloadBusy ? 'Queuing…' : 'Download'}
                        </button>
                      ) : null}
                      {canApply ? (
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={Boolean(busyVersionKey)}
                          onClick={() => {
                            setBusyVersionKey(versionKey)
                            setVersionActionStatus(null)
                            void queueClientCommand(game.uuid, 'update', {
                              kind: row.kind,
                              versionUuid: row.uuid,
                            })
                              .then(() => {
                                setVersionActionStatus(`${row.label} queued for companion`)
                                showToast(`${row.label} queued for companion`, 'success')
                              })
                              .catch((err) => {
                                setVersionActionStatus(err?.message || 'Failed to queue apply')
                                showToast(err?.message || 'Queue failed', 'error')
                              })
                              .finally(() => {
                                setBusyVersionKey(null)
                              })
                          }}
                        >
                          {applyBusy ? 'Queuing…' : 'Apply with companion'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {showsRetroarchCheats(game) ? (
        <CheatsPanel
          gameUuid={game.uuid}
          playHref={playHref}
          cheatSurface={game.cheat_surface}
        />
      ) : null}

      {/* FEAT-D2 — the PC counterpart. Self-gates on cheat_surface, so the two
          panels can never both render for one title. */}
      <PcCheatsPanel
        gameUuid={game.uuid}
        cheatSurface={game.cheat_surface}
        canEdit={Boolean(game.can_edit)}
      />

      <section className="gt-details-page__section" id="extras">
        <h2>Extras &amp; DLC</h2>
        {extrasModel.loading ? (
          <p className="gt-details-page__muted">Loading extras…</p>
        ) : extrasModel.rows.length === 0 ? (
          <p className="gt-details-page__muted">
            No extras or DLC listed for this title yet.
          </p>
        ) : (
          <ul className="gt-details-page__versions">
            {extrasModel.rows.map((row) => {
              const versionKey = `extra:${row.uuid || row.id}`
              const applyBusy = busyVersionKey === versionKey
              const onServer =
                row.on_server === true ? 'On server' : row.on_server === false ? 'Not on server' : null
              const sizeLabel = formatVersionSize(row.size)
              const pathMissing = row.path_missing === true || isVersionPathMissing(row)
              return (
                <li key={row.id || row.uuid || row.label}>
                  <div className="gt-details-page__version-row">
                    <div className="gt-details-page__version-meta">
                      <strong>{row.label}</strong>
                      <span className="gt-details-page__muted">
                        {' '}
                        · {row.kind}
                        {sizeLabel ? ` · ${sizeLabel}` : ''}
                        {onServer ? ` · ${onServer}` : ''}
                      </span>
                      {pathMissing ? (
                        <span className="gt-details-page__muted gt-details-page__version-missing">
                          {' '}
                          · Missing on disk
                        </span>
                      ) : null}
                    </div>
                    <div className="gt-details-page__version-actions">
                      {row.download_url && !pathMissing ? (
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={Boolean(busyVersionKey)}
                          onClick={() => {
                            void handleVersionDownload({
                              kind: 'extra',
                              versionUuid: row.uuid,
                              label: row.label,
                            })
                          }}
                        >
                          {busyVersionKey === `download:extra:${row.uuid || 'base'}`
                            ? 'Queuing…'
                            : 'Download'}
                        </button>
                      ) : null}
                      {game.client_connected && row.uuid && row.download_url && !pathMissing ? (
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={Boolean(busyVersionKey)}
                          onClick={() => {
                            setBusyVersionKey(versionKey)
                            setVersionActionStatus(null)
                            void queueClientCommand(game.uuid, 'update', {
                              kind: 'extra',
                              versionUuid: row.uuid,
                            })
                              .then(() => {
                                setVersionActionStatus(`${row.label} queued for companion`)
                                showToast(`${row.label} queued for companion`, 'success')
                              })
                              .catch((err) => {
                                setVersionActionStatus(err?.message || 'Failed to queue apply')
                                showToast(err?.message || 'Queue failed', 'error')
                              })
                              .finally(() => {
                                setBusyVersionKey(null)
                              })
                          }}
                        >
                          {applyBusy ? 'Queuing…' : 'Apply with companion'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Related media sits above screenshots and trailer by request — it is
          context about the game, so it reads before the gallery. Renders
          nothing when a title has none. */}
      <RelatedMediaStrip gameUuid={game.uuid} />

      {shownShots.length ? (
        <section className="gt-details-page__section">
          <h2>Screenshots</h2>
          <div className="gt-details-page__shots">
            {shownShots.map((url, index) => (
              <button
                key={url}
                type="button"
                className="gt-details-page__shot"
                onClick={() => setShotIndex(index)}
                onDoubleClick={() => setShotIndex(index)}
                aria-label={`Open screenshot ${index + 1}`}
                title="Click to open · double-click for fullscreen viewer"
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  onError={() => markShotBroken(url)}
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ScreenshotLightbox
        urls={shownShots}
        openIndex={shotIndex}
        onClose={() => setShotIndex(null)}
      />

      <section className="gt-details-page__section">
        <h2>Trailers &amp; videos</h2>
        {videoEmbeds.length > 0 ? (
          <div className="gt-details-page__videos">
            {videoEmbeds.map((src, index) => (
              <div key={src} className="gt-details-page__video-card">
                <iframe
                  title={`Game trailer ${index + 1}`}
                  src={src}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
                <div className="gt-details-page__video-actions">
                  <button
                    type="button"
                    className="gt-btn"
                    onClick={() => setVideoIndex(index)}
                  >
                    Fullscreen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : demoLink ? (
          <p className="gt-details-page__muted">
            No embedded trailer yet.{' '}
            <a className="gt-btn" href={demoLink.href} target="_blank" rel="noreferrer">
              {demoLink.label}
            </a>
          </p>
        ) : (
          <p className="gt-details-page__muted">
            No trailers or videos for this title yet.
          </p>
        )}
      </section>

      <ScreenshotLightbox
        mode="videos"
        videos={videoEmbeds}
        openIndex={videoIndex}
        onClose={() => setVideoIndex(null)}
      />

      <OpenPathModal
        open={Boolean(pathModal)}
        path={pathModal?.path || ''}
        label={pathModal?.label || 'Path'}
        gameUuid={game.uuid}
        clientConnected={Boolean(game.client_connected)}
        onClose={() => setPathModal(null)}
      />
    </div>
  )
}
