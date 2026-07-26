import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { checkGameFreshness, fetchGameDetails, fetchGameVersions } from '../api/gameDetails'
import { queueClientCommand } from '../api/clientCommands'
import { BadgeStack } from '../components/BadgeStack'
import { GameActionBar } from '../components/GameActionBar'
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

  const videoEmbeds = useMemo(() => {
    if (!game?.video_urls) {
      return []
    }
    return game.video_urls.map(youtubeEmbed).filter(Boolean)
  }, [game])

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
            src={game.cover_url || '/static/newstyle/default_cover.jpg'}
            alt=""
          />
          <BadgeStack game={game} preferredCorner="bottom-left" maxVisible={4} />
        </div>
        <div className="gt-details-page__hero-main">
          <h1>{game.name}</h1>
          <p className="gt-details-page__meta-line">
            {[game.developer, game.publisher, game.category, game.first_release_date]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="gt-details-page__chips">
            {game.size ? <span className="chip">{game.size}</span> : null}
            {game.status_label ? <span className="chip">{game.status_label}</span> : null}
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
            {game.can_play_in_browser && game.play_url ? (
              <a className="gt-btn gt-btn--primary" href={game.play_url}>
                Play in browser
              </a>
            ) : null}
            {game.steam_url ? (
              <a className="gt-btn" href={game.steam_url} target="_blank" rel="noreferrer">
                Steam store
              </a>
            ) : null}
            {game.steam_app_id ? (
              <a className="gt-btn" href={`steam://run/${game.steam_app_id}`}>
                Launch Steam
              </a>
            ) : null}
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
        {game.urls?.length ? (
          <ul className="gt-details-page__links">
            {game.urls.map((row) => (
              <li key={`${row.type}-${row.url}`}>
                <a href={row.url} target="_blank" rel="noreferrer">
                  {row.type || 'Link'}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
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
            {game.screenshots.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

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
