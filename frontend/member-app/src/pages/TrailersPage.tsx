import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ContextBar, Popover } from '../chrome/ContextBar'
import {
  fetchAttractModeSettings,
  fetchRandomTrailer,
  fetchTrailerFilters,
  saveAttractModePreferences,
} from '../api/trailers'
import { PageStatus } from '../components/PageStatus'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { showToast } from '../utils/toast'
import '../components/libraryFilters.css'
import './TrailersPage.css'
import { Button, useShellConfig } from '@oneirodex/ui'
import {
  ATTRACT_RETURN_KEY,
  DEFAULT_SETTINGS,
  EMPTY_FILTERS,
  SETTINGS_STORAGE_KEY,
  fromServerFilters,
  labelsFor,
  normalizeSettings,
  readStoredSettings,
  toServerFilters,
  youTubeVideoId,
} from './trailers/trailersHelpers'
import { TrailerPlayer } from './trailers/TrailerPlayer'
import { FilterPanel } from './trailers/TrailerFilterPanel'
import { SettingsModal } from './trailers/TrailerSettingsModal'

export function TrailersPage() {
  const shellConfig = useShellConfig()
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [attractMode] = useState(() =>
    new URLSearchParams(window.location.search).has('attract_mode'),
  )
  const [options, setOptions] = useState<any>(null)
  const [optionsError, setOptionsError] = useState<any>(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [request, setRequest] = useState({ id: 0, filters: EMPTY_FILTERS })
  const [trailer, setTrailer] = useState<any>(null)
  const [emptyMessage, setEmptyMessage] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filtersRef = useRef(filters)
  const settingsRef = useRef(settings)
  const trailerRef = useRef<any>(null)

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    trailerRef.current = trailer
  }, [trailer])

  const requestTrailer = useCallback(() => {
    setRequest((current) => ({ id: current.id + 1, filters: filtersRef.current }))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setEmptyMessage(null)
    // Keep the last trailer on screen until a replacement arrives so
    // "Another one" does not collapse the player (UX-B6).

    fetchRandomTrailer({ signal: controller.signal, filters: request.filters })
      .then((data) => {
        if (!active) {
          return
        }
        if (data?.has_videos) {
          setTrailer(data)
        } else {
          setTrailer(null)
          setEmptyMessage(
            data?.message ||
              (data?.code === 'no_trailers'
                ? 'No trailers in your library yet.'
                : 'No games with trailers found matching your filters'),
          )
        }
        setLoading(false)
      })
      .catch((err: any) => {
        if (!active || err.name === 'AbortError') {
          return
        }
        setError(err)
        setLoading(false)
        if (trailerRef.current) {
          showToast('Unable to load trailers.', 'error')
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [request])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetchTrailerFilters({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setOptions(data)
        }
      })
      .catch((err: any) => {
        if (active && err.name !== 'AbortError') {
          setOptionsError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!attractMode) {
      setSettings(readStoredSettings())
      return undefined
    }

    const controller = new AbortController()
    let active = true

    fetchAttractModeSettings({ signal: controller.signal })
      .then((data) => {
        if (!active) {
          return
        }
        if (data?.settings?.autoplay) {
          setSettings(normalizeSettings(data.settings.autoplay))
        }
        if (data?.settings?.filters) {
          setFilters(fromServerFilters(data.settings.filters))
        }
      })
      .catch(() => {
        if (active) {
          setSettings(readStoredSettings())
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [attractMode])

  const openBigPicture = useCallback(() => {
    const uuid = trailerRef.current?.game_uuid
    window.location.href = uuid ? `/big-picture?game=${encodeURIComponent(uuid)}` : '/big-picture'
  }, [])

  useEffect(() => {
    if (!attractMode) {
      return undefined
    }

    const onKeyDown = (event: any) => {
      if (event.key !== 'b' && event.key !== 'B') {
        return
      }
      const tag = event.target?.tagName || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      event.preventDefault()
      openBigPicture()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [attractMode, openBigPicture])

  const activeFilterBadges = useMemo(() => {
    const badges = []
    const library = (options?.libraries || []).find((item: any) => item.uuid === filters.library)
    if (library) {
      badges.push(library.name)
    }
    badges.push(...labelsFor(options?.genres, filters.genres))
    badges.push(...labelsFor(options?.themes, filters.themes))
    if (filters.dateFrom || filters.dateTo) {
      badges.push(`${filters.dateFrom || '...'}-${filters.dateTo || '...'}`)
    }
    return badges
  }, [options, filters])

  function handleFilterChange(patch: any) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function handleApply() {
    requestTrailer()
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS)
  }

  function exitAttractMode() {
    let returnUrl = null
    try {
      returnUrl = window.sessionStorage.getItem(ATTRACT_RETURN_KEY)
      if (returnUrl) {
        window.sessionStorage.removeItem(ATTRACT_RETURN_KEY)
      }
    } catch {
      returnUrl = null
    }
    window.location.href = returnUrl || '/discover'
  }

  async function handleSaveSettings(draft: any) {
    const next = normalizeSettings(draft)
    setSettings(next)
    setSettingsOpen(false)

    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private-mode storage failures should not block the in-memory setting.
    }

    try {
      await saveAttractModePreferences({
        autoplay: next,
        filters: toServerFilters(filtersRef.current),
      })
    } catch {
      // Server-side persistence is a bonus; localStorage already holds the value.
    }
  }

  const videoId = trailer ? youTubeVideoId(trailer.video_url) : null

  return (
    <>
      {useNewChrome ? (
        /* Title moved out of the bar and onto the player card (W27-F1) — the
           name belongs to the video you are watching, not to the page. Filters
           join Settings and "Another one" here for the same reason they are
           grouped on Calendar: one Filters popover per page, in the same place
           on every page. */
        <ContextBar
          /* Filters · Another one · More are one outlined cluster (Library
             Apply/Clear shape). Leaving Filters in the lead slot and the other
             two in the centre left three peer pills that did not read as the
             same control. */
          actions={
            <div className="od-cbtn-group" role="group" aria-label="Trailers">
              <Popover label="Filters" count={activeFilterBadges.length} align="start" chromeless>
                {({ close }: LooseProps) => (
                  <div className="library-filters-stack">
                    <FilterPanel
                      options={options}
                      optionsError={optionsError}
                      filters={filters}
                      onChange={handleFilterChange}
                      onClear={handleClear}
                      onApply={() => {
                        handleApply()
                        close()
                      }}
                    />
                  </div>
                )}
              </Popover>
              <button type="button" className="od-cbtn" onClick={requestTrailer}>
                Another one
              </button>
              <Popover label="More" align="end">
                <div className="od-trailers__overflow">
                  <button
                    type="button"
                    className="menu-button"
                    onClick={() => setSettingsOpen(true)}
                  >
                    Settings
                  </button>
                  {attractMode ? (
                    <>
                      <button type="button" className="menu-button" onClick={openBigPicture}>
                        Big Picture
                      </button>
                      <button type="button" className="menu-button" onClick={exitAttractMode}>
                        Exit Attract Mode
                      </button>
                    </>
                  ) : null}
                </div>
              </Popover>
            </div>
          }
        />
      ) : null}
      <div className="od-more-page od-trailers">
        {useNewChrome ? null : (
          <>
            <div className="od-page-header">
              {trailer ? (
                <a className="od-trailers__title-link" href={`/game_details/${trailer.game_uuid}`}>
                  <h1>{trailer.game_name}</h1>
                </a>
              ) : (
                <h1>Trailers</h1>
              )}

              <div className="od-trailers__actions">
                {attractMode ? (
                  <>
                    <Button onClick={exitAttractMode}>Exit Attract Mode</Button>
                    <Button onClick={openBigPicture}>Big Picture</Button>
                  </>
                ) : null}
                <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
                <Button className="od-btn--accent" onClick={requestTrailer}>
                  Another one
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Not rendered under the new chrome (W27-F1): the bar owns the one
          Filters popover, and a second toggle on the page was the duplication
          the two-bar layout exists to remove.

          Conditional render rather than the `hidden` attribute, which did
          nothing here: `.od-trailers__filters` sets `display: flex`, and an
          author rule always beats the UA stylesheet's `[hidden]`. Both controls
          were showing. */}
        {useNewChrome ? null : (
          <div className="od-trailers__filters">
            <Button
              className="od-trailers__filter-toggle"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((open) => !open)}
            >
              Filters
            </Button>

            {!panelOpen && activeFilterBadges.length > 0 ? (
              <div className="od-trailers__badges">
                {activeFilterBadges.map((badge, index) => (
                  <span key={`${index}-${badge}`} className="od-trailers__badge">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}

            {panelOpen ? (
              <FilterPanel
                options={options}
                optionsError={optionsError}
                filters={filters}
                onChange={handleFilterChange}
                onClear={handleClear}
                onApply={handleApply}
              />
            ) : null}
          </div>
        )}

        <LoadingOverlay
          active={loading && Boolean(trailer)}
          delayMs={250}
          label="Loading random trailer…"
        />

        {loading && !trailer ? (
          <PageStatus loading loadingMessage="Loading random trailer…" />
        ) : null}

        {!loading && error && !trailer ? (
          <PageStatus
            error={error}
            errorMessage="Unable to load trailers."
            onRetry={requestTrailer}
            retryLabel="Retry"
          />
        ) : null}

        {!loading && !error && emptyMessage ? (
          <p className="od-trailers__empty" role="status">
            {emptyMessage}
          </p>
        ) : null}

        {!loading && !error && trailer && !videoId ? (
          <PageStatus error errorMessage="Invalid video URL format" />
        ) : null}

        {trailer && videoId ? (
          <TrailerPlayer
            key={videoId}
            videoId={videoId}
            skipFirst={settings.skipFirst}
            settingsRef={settingsRef}
            onAdvance={requestTrailer}
            title={useNewChrome ? trailer.game_name : null}
            gameUuid={trailer.game_uuid}
          />
        ) : null}

        {settingsOpen ? (
          <SettingsModal
            settings={settings}
            onCancel={() => setSettingsOpen(false)}
            onSave={handleSaveSettings}
          />
        ) : null}
      </div>
    </>
  )
}
