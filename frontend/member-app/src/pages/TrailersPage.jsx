import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ContextBar } from '../chrome/ContextBar'
import {
  fetchAttractModeSettings,
  fetchRandomTrailer,
  fetchTrailerFilters,
  saveAttractModePreferences,
} from '../api/trailers'
import './TrailersPage.css'

const SETTINGS_STORAGE_KEY = 'trailerAutoplaySettings'
const ATTRACT_RETURN_KEY = 'attractModeReturnUrl'
const DEFAULT_SETTINGS = { enabled: true, skipFirst: 0, skipAfter: 0 }
const EMPTY_FILTERS = { library: '', genres: [], themes: [], dateFrom: '', dateTo: '' }

/** Mirrors the server-side whitelist in convert_to_embed_url; anything else is rejected. */
const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /youtu\.be\/([a-zA-Z0-9_-]+)/,
]

function youTubeVideoId(url) {
  if (typeof url !== 'string') {
    return null
  }
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

function buildEmbedSrc(videoId, skipFirst) {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  })
  if (skipFirst > 0) {
    params.set('start', String(skipFirst))
  }
  if (window.location?.origin) {
    params.set('origin', window.location.origin)
  }
  return `https://www.youtube.com/embed/${videoId}?${params}`
}

let youTubeApiPromise = null

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (youTubeApiPromise) {
    return youTubeApiPromise
  }

  youTubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') {
        previousCallback()
      }
      resolve(window.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })

  return youTubeApiPromise
}

function normalizeSettings(raw) {
  return {
    enabled: raw?.enabled !== false,
    skipFirst: Math.max(0, Number(raw?.skipFirst) || 0),
    skipAfter: Math.max(0, Number(raw?.skipAfter) || 0),
  }
}

function readStoredSettings() {
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    return saved ? normalizeSettings(JSON.parse(saved)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function fromServerFilters(raw) {
  return {
    library: raw?.library_uuid ? String(raw.library_uuid) : '',
    genres: Array.isArray(raw?.genres) ? raw.genres.map(String) : [],
    themes: Array.isArray(raw?.themes) ? raw.themes.map(String) : [],
    dateFrom: raw?.date_from ? String(raw.date_from) : '',
    dateTo: raw?.date_to ? String(raw.date_to) : '',
  }
}

function toServerFilters(filters) {
  return {
    library_uuid: filters.library || null,
    genres: filters.genres.map((id) => Number(id)),
    themes: filters.themes.map((id) => Number(id)),
    date_from: filters.dateFrom ? Number(filters.dateFrom) : null,
    date_to: filters.dateTo ? Number(filters.dateTo) : null,
  }
}

function selectedValues(select) {
  return Array.from(select.selectedOptions).map((option) => option.value)
}

function labelsFor(options, ids) {
  const wanted = new Set(ids.map(String))
  return (options || [])
    .filter((option) => wanted.has(String(option.id)))
    .map((option) => option.name)
}

/**
 * Renders the embed as a plain iframe so playback works even when the IFrame API
 * is unavailable, then binds a YT.Player to that same frame for the auto-advance
 * behaviour the Jinja page relied on.
 */
function TrailerPlayer({ videoId, skipFirst, settingsRef, onAdvance, title, gameUuid }) {
  const frameRef = useRef(null)
  const advanceRef = useRef(onAdvance)
  const [src] = useState(() => buildEmbedSrc(videoId, skipFirst))

  useEffect(() => {
    advanceRef.current = onAdvance
  }, [onAdvance])

  useEffect(() => {
    let cancelled = false
    let player = null
    let timer = null
    let playedSeconds = 0
    let isPlaying = false

    function stopTimer() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      playedSeconds = 0
      isPlaying = false
    }

    function startTimer() {
      if (timer) {
        return
      }
      timer = setInterval(() => {
        if (!isPlaying) {
          return
        }
        playedSeconds += 1
        const { skipAfter } = settingsRef.current
        if (skipAfter > 0 && playedSeconds >= skipAfter) {
          stopTimer()
          advanceRef.current?.()
        }
      }, 1000)
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT?.Player || !frameRef.current) {
        return
      }

      player = new YT.Player(frameRef.current, {
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              isPlaying = true
              startTimer()
            } else if (event.data === YT.PlayerState.PAUSED) {
              isPlaying = false
            } else if (event.data === YT.PlayerState.ENDED) {
              stopTimer()
              if (settingsRef.current.enabled) {
                advanceRef.current?.()
              }
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      stopTimer()
      try {
        player?.destroy?.()
      } catch {
        // The frame is already gone when React unmounted it first.
      }
    }
  }, [videoId, settingsRef])

  return (
    /* The set, not just a rectangle.
       Trailers are the one page that is purely about watching something, and a
       bare iframe on a flat panel is the least evocative way to present that in
       an app about games. The cabinet is drawn entirely from theme tokens — no
       image — so it recolours with whatever preset is chosen instead of pinning
       the page to one palette. Decorative parts are aria-hidden; the iframe is
       still just an iframe to a screen reader. */
    <div className="gt-trailers__set">
      <div className="gt-trailers__video">
        <span className="gt-trailers__scanlines" aria-hidden="true" />
        <span className="gt-trailers__glare" aria-hidden="true" />
        <iframe
          ref={frameRef}
          title={title ? `Trailer — ${title}` : 'Game trailer'}
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="gt-trailers__bezel" aria-hidden="true">
        <span className="gt-trailers__brand">GameTheca</span>
        <span className="gt-trailers__knobs">
          <span className="gt-trailers__knob" />
          <span className="gt-trailers__knob" />
          <span className="gt-trailers__led" />
        </span>
      </div>
      {/* Caption belongs to the video, not the page (W27-F1). It sits under the
          frame rather than over it so it never covers the picture, and it is a
          link because "what am I watching" and "take me to it" are the same
          question. */}
      {title ? (
        <p className="gt-trailers__caption">
          <a className="gt-trailers__title-link" href={`/game_details/${gameUuid}`}>
            {title}
          </a>
        </p>
      ) : null}
    </div>
  )
}

function FilterPanel({ options, optionsError, filters, onChange, onClear, onApply }) {
  const dateRange = options?.date_range || {}

  return (
    <div className="gt-trailers__filter-grid">
      {optionsError ? (
        <p className="gt-trailers__filter-error">Filter options are unavailable right now.</p>
      ) : null}

      <div className="gt-trailers__filter-item">
        <label htmlFor="gt-trailers-library">Library</label>
        <select
          id="gt-trailers-library"
          value={filters.library}
          onChange={(event) => onChange({ library: event.target.value })}
        >
          <option value="">All Libraries</option>
          {(options?.libraries || []).map((library) => (
            <option key={library.uuid} value={library.uuid}>
              {library.name}
            </option>
          ))}
        </select>
      </div>

      <div className="gt-trailers__filter-item">
        <label htmlFor="gt-trailers-date-from">Release Year From</label>
        <input
          id="gt-trailers-date-from"
          type="number"
          min={dateRange.min_year || 1970}
          max={dateRange.max_year || 2030}
          placeholder={`e.g., ${dateRange.min_year || 1990}`}
          value={filters.dateFrom}
          onChange={(event) => onChange({ dateFrom: event.target.value })}
        />
      </div>

      <div className="gt-trailers__filter-item">
        <label htmlFor="gt-trailers-date-to">Release Year To</label>
        <input
          id="gt-trailers-date-to"
          type="number"
          min={dateRange.min_year || 1970}
          max={dateRange.max_year || 2030}
          placeholder={`e.g., ${dateRange.max_year || 2024}`}
          value={filters.dateTo}
          onChange={(event) => onChange({ dateTo: event.target.value })}
        />
      </div>

      <div className="gt-trailers__filter-item">
        <label htmlFor="gt-trailers-genres">Genres</label>
        <select
          id="gt-trailers-genres"
          multiple
          size={10}
          value={filters.genres}
          onChange={(event) => onChange({ genres: selectedValues(event.target) })}
        >
          {(options?.genres || []).map((genre) => (
            <option key={genre.id} value={String(genre.id)}>
              {genre.name}
            </option>
          ))}
        </select>
        <small>Hold Ctrl/Cmd to select multiple</small>
      </div>

      <div className="gt-trailers__filter-item">
        <label htmlFor="gt-trailers-themes">Themes</label>
        <select
          id="gt-trailers-themes"
          multiple
          size={10}
          value={filters.themes}
          onChange={(event) => onChange({ themes: selectedValues(event.target) })}
        >
          {(options?.themes || []).map((theme) => (
            <option key={theme.id} value={String(theme.id)}>
              {theme.name}
            </option>
          ))}
        </select>
        <small>Hold Ctrl/Cmd to select multiple</small>
      </div>

      <div className="gt-trailers__filter-actions">
        <button type="button" onClick={onApply}>
          Apply filters
        </button>
        <button type="button" onClick={onClear}>
          Clear All Filters
        </button>
      </div>
    </div>
  )
}

function SettingsModal({ settings, onCancel, onSave }) {
  const [draft, setDraft] = useState(settings)

  return (
    <div className="gt-trailers__modal-overlay" role="dialog" aria-modal="true" aria-label="Auto-Play Settings">
      <div className="gt-trailers__modal">
        <h2>Auto-Play Settings</h2>

        <label className="gt-trailers__toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          Auto-play next video
        </label>

        <label htmlFor="gt-trailers-skip-first">Skip first (seconds)</label>
        <input
          id="gt-trailers-skip-first"
          type="number"
          min={0}
          max={300}
          value={draft.skipFirst}
          onChange={(event) => setDraft({ ...draft, skipFirst: event.target.value })}
        />

        <label htmlFor="gt-trailers-skip-after">Skip to next after playing (seconds)</label>
        <input
          id="gt-trailers-skip-after"
          type="number"
          min={0}
          max={600}
          value={draft.skipAfter}
          onChange={(event) => setDraft({ ...draft, skipAfter: event.target.value })}
        />
        <small>Load next video after watching for this long (0 to disable)</small>

        <div className="gt-trailers__modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function TrailersPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [attractMode] = useState(
    () => new URLSearchParams(window.location.search).has('attract_mode'),
  )
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [request, setRequest] = useState({ id: 0, filters: EMPTY_FILTERS })
  const [trailer, setTrailer] = useState(null)
  const [emptyMessage, setEmptyMessage] = useState(null)
  const [emptyCta, setEmptyCta] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filtersRef = useRef(filters)
  const settingsRef = useRef(settings)
  const trailerRef = useRef(null)

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
    setEmptyCta(null)
    setTrailer(null)

    fetchRandomTrailer({ signal: controller.signal, filters: request.filters })
      .then((data) => {
        if (!active) {
          return
        }
        if (data?.has_videos) {
          setTrailer(data)
        } else {
          const cta = data?.cta && typeof data.cta === 'object' ? data.cta : null
          setEmptyMessage(
            data?.message ||
              (data?.code === 'no_trailers'
                ? 'No trailers in your library yet.'
                : 'No games with trailers found'),
          )
          setEmptyCta(
            cta?.href
              ? {
                  id: cta.id || 'library',
                  label: cta.label || 'Go to Library',
                  href: cta.href,
                }
              : { id: 'library', label: 'Go to Library', href: '/library' },
          )
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') {
          return
        }
        setError(err)
        setLoading(false)
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
      .catch((err) => {
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

    const onKeyDown = (event) => {
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
    const library = (options?.libraries || []).find((item) => item.uuid === filters.library)
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

  function handleFilterChange(patch) {
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

  async function handleSaveSettings(draft) {
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
          filters={
            <FilterPanel
              options={options}
              optionsError={optionsError}
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClear}
              onApply={handleApply}
            />
          }
          filterCount={activeFilterBadges.length}
          /* One visible action, the rest behind the overflow — the shape
             every other page's bar already has. Four peer buttons in a row was
             the trailers page inventing its own toolbar: "Another one" is what
             you press over and over, and Settings, Big Picture and Exit are
             each pressed once a session at most. Ranking them by how often they
             are used is what the two-bar design calls for; showing them as
             equals was what made this bar look unlike the others. */
          actions={
            <button type="button" className="gt-cbtn" onClick={requestTrailer}>
              Another one
            </button>
          }
          overflow={
            <div className="gt-trailers__overflow">
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
          }
        />
      ) : null}
    <div className="gt-more-page gt-trailers">
      {useNewChrome ? null : (
        <>
        <div className="gt-page-header">
          {trailer ? (
            <a className="gt-trailers__title-link" href={`/game_details/${trailer.game_uuid}`}>
              <h1>{trailer.game_name}</h1>
            </a>
          ) : (
            <h1>Trailers</h1>
          )}

          <div className="gt-trailers__actions">
            {attractMode ? (
              <>
                <button type="button" onClick={exitAttractMode}>
                  Exit Attract Mode
                </button>
                <button type="button" onClick={openBigPicture}>
                  Big Picture
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button type="button" onClick={requestTrailer}>
              Another one
            </button>
          </div>
        </div>
        </>
      )}

      {/* Not rendered under the new chrome (W27-F1): the bar owns the one
          Filters popover, and a second toggle on the page was the duplication
          the two-bar layout exists to remove.

          Conditional render rather than the `hidden` attribute, which did
          nothing here: `.gt-trailers__filters` sets `display: flex`, and an
          author rule always beats the UA stylesheet's `[hidden]`. Both controls
          were showing. */}
      {useNewChrome ? null : (
        <div className="gt-trailers__filters">
          <button
            type="button"
            className="gt-trailers__filter-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            Filters
          </button>

          {!panelOpen && activeFilterBadges.length > 0 ? (
            <div className="gt-trailers__badges">
              {activeFilterBadges.map((badge, index) => (
                <span key={`${index}-${badge}`} className="gt-trailers__badge">
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

      {loading ? <p>Loading random trailer…</p> : null}

      {!loading && error ? (
        <div role="alert">
          <p>Unable to load trailers.</p>
          <button type="button" onClick={requestTrailer}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && emptyMessage ? (
        <div className="gt-trailers__empty" role="status">
          <p>{emptyMessage}</p>
          {emptyCta?.href ? (
            <a href={emptyCta.href}>{emptyCta.label || 'Go to Library'}</a>
          ) : (
            <a href="/library">Go to Library</a>
          )}
        </div>
      ) : null}

      {!loading && !error && trailer && !videoId ? (
        <p role="alert">Invalid video URL format</p>
      ) : null}

      {!loading && !error && videoId ? (
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
