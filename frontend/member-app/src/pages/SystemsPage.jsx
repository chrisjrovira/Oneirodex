import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { familyForPlatform } from '../chrome/platformSkins'
import { roomIdForPlatform, roomStyle } from '../chrome/playRooms'
import { SystemGlyph } from '../components/systemMotifArt'
import './SystemsPage.css'

async function fetchLibraryPlatforms({ signal } = {}) {
  const response = await fetch('/api/library_platforms?include_completion=1', {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`library_platforms ${response.status}`)
  }
  return response.json()
}

const FAMILY_ORDER = ['nintendo', 'sony', 'xbox', 'sega', 'pc', 'atari']

const FAMILY_LABELS = {
  nintendo: 'Nintendo',
  sony: 'Sony',
  xbox: 'Xbox',
  sega: 'Sega',
  pc: 'PC & Other',
  atari: 'Retro & Classic',
}

function playModeLabel(mode) {
  if (mode === 'browser') {
    return 'Browser'
  }
  if (mode === 'companion') {
    return 'Companion'
  }
  if (mode === 'catalog') {
    return 'Catalog'
  }
  return null
}

function groupPlatforms(platforms) {
  const groups = new Map()
  for (const platform of platforms) {
    const family = familyForPlatform(platform.value || platform.id)
    if (!groups.has(family)) {
      groups.set(family, [])
    }
    groups.get(family).push(platform)
  }
  return FAMILY_ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    label: FAMILY_LABELS[id] || id,
    platforms: groups.get(id),
  }))
}

export function SystemsPage({ shellConfig: _shellConfig } = {}) {
  const [platforms, setPlatforms] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)

    fetchLibraryPlatforms({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setPlatforms(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
          // Keep platforms null so the error/retry UI wins over empty-state.
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  const groups = useMemo(
    () => groupPlatforms(platforms || []),
    [platforms],
  )

  if (error && !platforms) {
    return (
      <div className="gt-more-page gt-systems-page">
        <div role="alert">
          <p>Unable to load systems.</p>
          <button type="button" className="gt-btn" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (platforms === null) {
    return (
      <div className="gt-more-page gt-systems-page">
        <p className="gt-more-page__lede">Loading systems…</p>
      </div>
    )
  }

  if (platforms.length === 0) {
    return (
      <div className="gt-more-page gt-systems-page">
        <p className="gt-more-page__lede">
          No library platforms yet. Add a library with a console or PC platform to see it here.
        </p>
        <Link className="gt-btn" to="/library">
          Browse all library
        </Link>
        <ExportPacksSection />
      </div>
    )
  }

  return (
    <div className="gt-more-page gt-systems-page">
      <p className="gt-more-page__lede">
        Browse your library by console or PC. Open a system to filter the grid and apply that era&apos;s chrome.
      </p>
      {groups.map((group) => (
        <section key={group.id} className="gt-systems-group" data-family={group.id}>
          <h2 className="gt-systems-group__title">{group.label}</h2>
          <div className="gt-systems-grid">
            {group.platforms.map((platform) => {
              const value = platform.value || platform.id
              const count = Number(platform.game_count) || 0
              const modeLabel = playModeLabel(platform.play_mode)
              const completion = platform.set_completion
              return (
                <div
                  key={value}
                  className="gt-systems-tile gt-btn"
                  data-platform={value}
                  data-family={group.id}
                  data-play-mode={platform.play_mode || undefined}
                  /* FEAT-D5: dressed for the room it was played in, not the
                     brand that made it. */
                  data-room={roomIdForPlatform(value)}
                  style={roomStyle(value)}
                >
                  <Link
                    className="gt-systems-tile__main"
                    to={`/library?library_platform=${encodeURIComponent(value)}`}
                  >
                    {/* The system itself, not its manufacturer (W28). One
                        Nintendo mark stood in for NES, SNES, N64, GameCube,
                        Wii and Switch, on a coloured plate that made the tile
                        about the plate. SystemGlyph draws the per-system motif
                        the loading states already use. */}
                    <span className="gt-systems-tile__mark" aria-hidden="true">
                      <SystemGlyph platformValue={value} family={group.id} />
                    </span>
                    <span className="gt-systems-tile__body">
                      <span className="gt-systems-tile__name">{platform.name || value}</span>
                      <span className="gt-systems-tile__count">
                        {count} {count === 1 ? 'game' : 'games'}
                        {modeLabel ? (
                          <span className={`gt-systems-tile__mode gt-systems-tile__mode--${platform.play_mode}`}>
                            {modeLabel}
                          </span>
                        ) : null}
                      </span>
                      {completion ? (
                        <span className="gt-systems-tile__completion">
                          {completion.owned} / {completion.total} · {completion.percent}% ({completion.region})
                        </span>
                      ) : null}
                      {Array.isArray(platform.set_completion_regions) &&
                      platform.set_completion_regions.length > 1 ? (
                        <span className="gt-systems-tile__regions" aria-label="Set completion by region">
                          {platform.set_completion_regions.map((regionRow) => {
                            const pct = Number(regionRow.percent) || 0
                            const heat =
                              pct >= 90 ? 'high' : pct >= 50 ? 'mid' : pct > 0 ? 'low' : 'empty'
                            return (
                              <Link
                                key={regionRow.region}
                                className={`gt-systems-tile__region gt-systems-tile__region--${heat}`}
                                to={`/systems/completion?library_platform=${encodeURIComponent(value)}&region=${encodeURIComponent(regionRow.region)}`}
                                title={`${regionRow.region}: ${regionRow.owned}/${regionRow.total} (${regionRow.percent}%)`}
                              >
                                {regionRow.region}
                                <span className="gt-systems-tile__region-pct">{regionRow.percent}%</span>
                              </Link>
                            )
                          })}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  {completion ? (
                    <Link
                      className="gt-systems-tile__set-link"
                      to={`/systems/completion?library_platform=${encodeURIComponent(value)}&region=${encodeURIComponent(completion.region)}`}
                    >
                      Missing
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <ExportPacksSection />
    </div>
  )
}

function ExportPacksSection() {
  return (
    <section className="gt-systems-exports" aria-labelledby="gt-systems-exports-title">
      <h2 id="gt-systems-exports-title" className="gt-systems-group__title">
        Export packs
      </h2>
      <p className="gt-systems-exports__lede">
        Optional downloads for other frontends — not required to browse here.{' '}
        <strong>ES-DE</strong> gets a <code>gamelist.xml</code> (EmulationStation Desktop Edition
        style list). <strong>Pegasus</strong> gets a metadata pack for its frontend. File paths stay
        portable under your library roots so home/NAS mounts are not leaked.
      </p>
      <div className="gt-systems-exports__actions">
        <a className="gt-btn" href="/api/export/esde">
          ES-DE gamelist.xml
        </a>
        <a className="gt-btn" href="/api/export/pegasus?platform=Library">
          Pegasus metadata
        </a>
      </div>
    </section>
  )
}
