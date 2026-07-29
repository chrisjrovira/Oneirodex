import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { checkGameFreshness, fetchGameDetails, fetchGameVersions } from '../api/gameDetails'
import { attachPatchCatalogGuide, searchPatchCatalog } from '../api/patchCatalog'
import { queueClientCommand } from '../api/clientCommands'
import { BadgeStack } from '../components/BadgeStack'
import { ExternalStoreLinks } from '../components/ExternalStoreLinks'
import { GameActionBar } from '../components/GameActionBar'
import { ScreenshotLightbox } from '../components/ScreenshotLightbox'
import { coverUrl } from '../utils/coverUrl'
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

function youtubeEmbed(url) {
  if (!url || typeof url !== 'string') {
    return null
  }
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
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
  const [selectedCore, setSelectedCore] = useState('')
  const [catalogHits, setCatalogHits] = useState([])
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState(null)
  const [shotIndex, setShotIndex] = useState(null)

  useEffect(() => {
    if (!gameUuid) {
      return undefined
    }
    const controller = new AbortController()
    let active = true
    setError(null)
    setGame(null)

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
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
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

  const videoEmbeds = useMemo(() => {
    if (!game?.video_urls) {
      return []
    }
    return game.video_urls.map(youtubeEmbed).filter(Boolean)
  }, [game])

  const playHref = useMemo(() => {
    if (!game?.can_play_in_browser) {
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
    return `/static/vendor/webretro/webretro.html?guid=${encodeURIComponent(game.uuid)}&core=${encodeURIComponent(core)}${platform}`
  }, [game, selectedCore])

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
      if (window.$?.notify) {
        window.$.notify(err?.message || 'Freshness check failed', 'error')
      }
    } finally {
      setFreshnessBusy(false)
    }
  }

  if (error && !game) {
    return (
      <div className="gt-more-page gt-details-page">
        <div role="alert">
          <p>Unable to load game details.</p>
          <button type="button" className="gt-btn" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="gt-more-page gt-details-page">
        <p className="gt-more-page__lede">Loading game…</p>
      </div>
    )
  }

  return (
    <div className="gt-more-page gt-details-page">
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
        <div className="gt-details-page__cover-wrap">
          <img
            className="gt-details-page__cover"
            src={coverUrl(game.cover_url)}
            alt=""
          />
          <BadgeStack game={game} preferredCorner="bottom-left" maxVisible={2} />
        </div>
        <div className="gt-details-page__hero-main">
          <h1>{game.name}</h1>
          <p className="gt-details-page__meta-line">
            {[game.developer, game.publisher, game.category, game.first_release_date]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="gt-details-page__chips">
            {game.local_version ? (
              <span className="chip" title="Installed / library version">
                Version {game.local_version}
              </span>
            ) : null}
            {game.remote_version_summary ? (
              <span className="chip" title="Remote / store version summary">
                Remote {game.remote_version_summary}
              </span>
            ) : null}
            {game.size ? <span className="chip">{game.size}</span> : null}
            {game.status_label ? <span className="chip">{game.status_label}</span> : null}
            {game.rom_region || game.rom_languages ? (
              <span className="chip" title="ROM region / languages from filename">
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
              <span className="chip">Freshness: {game.freshness_status}</span>
            ) : null}
            {game.hltb_main_story != null ? (
              <span className="chip">HLTB main {Number(game.hltb_main_story).toFixed(1)}h</span>
            ) : null}
            {game.is_favorite ? <span className="chip">Favorite</span> : null}
          </div>
          <GameActionBar
            gameUuid={game.uuid}
            gameName={game.name}
            lifecycleState={game.lifecycle_state || 'not_downloaded'}
            clientConnected={Boolean(game.client_connected)}
            variant="full"
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
            ) : game.play_blocker === 'unsupported_archive' ? (
              <button
                type="button"
                className="gt-btn gt-btn--primary"
                disabled
                title={
                  game.companion_hint ||
                  'This archive type cannot be extracted for browser play. Use .zip / .7z / .rar / ROM.gz or a raw ROM.'
                }
              >
                Play in browser
              </button>
            ) : null}
            {game.steam_app_id ? (
              <a className="gt-btn" href={`steam://run/${game.steam_app_id}`}>
                Launch Steam
              </a>
            ) : null}
            <ExternalStoreLinks
              urls={game.urls}
              steamUrl={game.steam_url}
              igdbUrl={game.url_igdb || game.url}
            />
            <button
              type="button"
              className="gt-btn"
              disabled={freshnessBusy}
              onClick={() => {
                void handleFreshnessCheck()
              }}
            >
              {freshnessBusy ? 'Checking…' : 'Check stores'}
            </button>
          </div>
          {freshnessError ? (
            <p className="gt-details-page__muted" role="alert">
              Store check failed: {String(freshnessError.message || freshnessError)}
            </p>
          ) : null}
        </div>
      </div>

      {game.summary ? (
        <section className="gt-details-page__section">
          <h2>Summary</h2>
          <p className="gt-details-page__summary">{game.summary}</p>
        </section>
      ) : null}

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
                                  if (window.$?.notify) {
                                    window.$.notify(
                                      `${patch.label} queued for companion apply`,
                                      'success',
                                    )
                                  }
                                })
                                .catch((err) => {
                                  setVersionActionStatus(err?.message || 'Failed to queue apply')
                                  if (window.$?.notify) {
                                    window.$.notify(err?.message || 'Queue failed', 'error')
                                  }
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
                Search your local YAML/JSON patch guide catalog (metadata only — no third-party scrape).
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
                                  if (window.$?.notify) {
                                    window.$.notify('Guide attached', 'success')
                                  }
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

      <section className="gt-details-page__section">
        <h2>Details</h2>
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
                  <Link key={name} className="chip" to={`/library?genre=${encodeURIComponent(name)}`}>
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

      {versions.length > 0 ? (
        <section className="gt-details-page__section" id="updates">
          <h2>Versions & extras</h2>
          {versionActionStatus ? (
            <p className="gt-details-page__muted" role="status">
              {versionActionStatus}
            </p>
          ) : null}
          <ul className="gt-details-page__versions">
            {versions.map((row) => {
              const downloadHref =
                row.kind === 'base'
                  ? `/download_game/${game.uuid}`
                  : `/download_other/${row.kind}/${game.uuid}/${row.uuid}`
              const versionKey = `${row.kind}:${row.uuid}`
              const canApply =
                Boolean(game.client_connected) &&
                (row.kind === 'update' || row.kind === 'extra')
              const applyBusy = busyVersionKey === versionKey
              return (
                <li key={`${row.kind}-${row.id || row.uuid}`}>
                  <div className="gt-details-page__version-row">
                    <div>
                      <strong>{row.label}</strong>
                      <span className="gt-details-page__muted">
                        {' '}
                        · {row.kind}
                        {row.is_default ? ' · default' : ''}
                        {row.size ? ` · ${row.size}` : ''}
                      </span>
                    </div>
                    <div className="gt-details-page__version-actions">
                      <a className="gt-btn" href={downloadHref}>
                        Download
                      </a>
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
                                if (window.$?.notify) {
                                  window.$.notify(`${row.label} queued for companion`, 'success')
                                }
                              })
                              .catch((err) => {
                                setVersionActionStatus(err?.message || 'Failed to queue apply')
                                if (window.$?.notify) {
                                  window.$.notify(err?.message || 'Queue failed', 'error')
                                }
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

      {game.screenshots?.length ? (
        <section className="gt-details-page__section">
          <h2>Screenshots</h2>
          <div className="gt-details-page__shots">
            {game.screenshots.map((url, index) => (
              <button
                key={url}
                type="button"
                className="gt-details-page__shot"
                onClick={() => setShotIndex(index)}
                aria-label={`Open screenshot ${index + 1}`}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ScreenshotLightbox
        urls={game.screenshots || []}
        openIndex={shotIndex}
        onClose={() => setShotIndex(null)}
      />

      {videoEmbeds.length > 0 ? (
        <section className="gt-details-page__section">
          <h2>Videos</h2>
          <div className="gt-details-page__videos">
            {videoEmbeds.map((src) => (
              <iframe
                key={src}
                title="Game trailer"
                src={src}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
