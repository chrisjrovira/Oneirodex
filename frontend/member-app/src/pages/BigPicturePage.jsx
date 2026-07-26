import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchBrowseGames } from '../api/browse'
import { queueClientCommand } from '../api/clientCommands'
import { coverUrl } from '../utils/coverUrl'
import './BigPicturePage.css'

const DEFAULT_PER_PAGE = 48
const GAMEPAD_DEADZONE = 0.5
const GAMEPAD_REPEAT_MS = 220

function badgeBits(game) {
  const bits = []
  if (game.owned || game.store_owned) {
    bits.push('OWNED')
  }
  if (
    game.lifecycle_state === 'update_available' ||
    game.freshness_status === 'behind' ||
    game.freshness_status === 'heuristic_behind'
  ) {
    bits.push('UPDATE')
  }
  if (game.client_connected) {
    bits.push('CLIENT')
  }
  return bits
}

function gameDetailsUrl(uuid) {
  return `/game_details/${encodeURIComponent(uuid)}`
}

function downloadUrl(uuid) {
  return `/download_game/${encodeURIComponent(uuid)}`
}

function attractUrl(uuid) {
  const qs = new URLSearchParams({ attract_mode: 'true' })
  if (uuid) {
    qs.set('game', uuid)
  }
  return `/trailers?${qs.toString()}`
}

function focusGameFromQuery() {
  try {
    return new URLSearchParams(window.location.search).get('game') || ''
  } catch (_err) {
    return ''
  }
}

export function BigPicturePage({ shellConfig = {} }) {
  const perPage = Number(shellConfig.perPage) || DEFAULT_PER_PAGE
  const [games, setGames] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [index, setIndex] = useState(0)
  const tileRefs = useRef([])
  const autoFocused = useRef(false)
  const padState = useRef({ games: [], index: 0, select: () => {} })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setGames(null)

    fetchBrowseGames(
      { per_page: perPage, sort_by: 'date_identified', sort_order: 'desc' },
      { signal: controller.signal },
    )
      .then((data) => {
        if (!active) {
          return
        }
        const list = Array.isArray(data.games) ? data.games : []
        const wanted = focusGameFromQuery()
        const found = wanted ? list.findIndex((game) => game.uuid === wanted) : -1
        tileRefs.current = []
        setGames(list)
        setIndex(found >= 0 ? found : 0)
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
  }, [perPage, retryCount])

  const list = games || []
  const selected = list[index] || null
  const loading = !error && games === null

  const select = (nextIndex) => {
    if (!list.length) {
      return
    }
    const clamped = Math.max(0, Math.min(list.length - 1, nextIndex))
    setIndex(clamped)
    const tile = tileRefs.current[clamped]
    tile?.focus()
    tile?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  useEffect(() => {
    padState.current = { games: list, index, select }
  })

  useEffect(() => {
    if (autoFocused.current || !games || games.length === 0) {
      return
    }
    autoFocused.current = true
    tileRefs.current[index]?.focus()
  }, [games, index])

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return undefined
    }

    let frame = 0
    let axisLatch = 0
    let lastNav = 0
    let confirmLatch = false

    const poll = () => {
      const pad = (navigator.getGamepads() || [])[0]
      const { games: padGames, index: padIndex } = padState.current
      if (!pad || !padGames.length) {
        frame = requestAnimationFrame(poll)
        return
      }

      const now = performance.now()
      const axisX = pad.axes[0] || 0
      const dpadLeft = pad.buttons[14]?.pressed
      const dpadRight = pad.buttons[15]?.pressed
      const dpadUp = pad.buttons[12]?.pressed
      const dpadDown = pad.buttons[13]?.pressed
      const confirm = pad.buttons[0]?.pressed
      const west = pad.buttons[2]?.pressed
      const east = pad.buttons[1]?.pressed

      let dir = 0
      if (axisX <= -GAMEPAD_DEADZONE || dpadLeft || dpadUp) {
        dir = -1
      } else if (axisX >= GAMEPAD_DEADZONE || dpadRight || dpadDown) {
        dir = 1
      }

      if (dir !== 0 && (dir !== axisLatch || now - lastNav > GAMEPAD_REPEAT_MS)) {
        padState.current.select(padIndex + dir)
        axisLatch = dir
        lastNav = now
      } else if (dir === 0) {
        axisLatch = 0
      }

      if (confirm) {
        if (!confirmLatch && now - lastNav > GAMEPAD_REPEAT_MS) {
          window.location.href = gameDetailsUrl(padGames[padIndex].uuid)
          lastNav = now
        }
        confirmLatch = true
      } else {
        confirmLatch = false
      }

      if (west && now - lastNav > GAMEPAD_REPEAT_MS) {
        window.location.href = downloadUrl(padGames[padIndex].uuid)
        lastNav = now
      }

      if (east && now - lastNav > GAMEPAD_REPEAT_MS) {
        window.location.href = attractUrl(padGames[padIndex].uuid)
        lastNav = now
      }

      frame = requestAnimationFrame(poll)
    }

    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
  }, [])

  const onKeyDown = (event) => {
    if (event.key === 'b' || event.key === 'B') {
      event.preventDefault()
      window.location.href = attractUrl(selected?.uuid)
      return
    }

    if (!list.length) {
      return
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        select(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        select(index - 1)
        break
      case 'Home':
        event.preventDefault()
        select(0)
        break
      case 'End':
        event.preventDefault()
        select(list.length - 1)
        break
      case 'd':
      case 'D':
        event.preventDefault()
        window.location.href = downloadUrl(list[index].uuid)
        break
      case 'Escape':
        event.preventDefault()
        tileRefs.current[index]?.blur()
        break
      default:
        break
    }
  }

  let heroTitle = 'No games'
  if (loading) {
    heroTitle = 'Loading…'
  } else if (selected) {
    heroTitle = selected.name || 'Untitled'
  }

  const heroMeta = selected
    ? [badgeBits(selected).join(' · '), selected.size ? String(selected.size) : '']
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="gt-bp">
      <header className="gt-bp__header">
        <div>
          <h1 className="gt-bp__title">Big Picture</h1>
          <p className="gt-bp__hint">
            ← → browse · Enter / A open · D download · B attract · Esc blur · Home first
          </p>
        </div>
        <div className="gt-bp__header-actions">
          <a
            className="gt-bp__link"
            href={attractUrl(selected?.uuid)}
            title="Open Attract Mode (B)"
          >
            Attract
          </a>
          <a className="gt-bp__exit" href="/library">
            Exit
          </a>
        </div>
      </header>

      {error ? (
        <div className="gt-bp__alert" role="alert">
          <p>Unable to load Big Picture.</p>
          <button
            type="button"
            className="gt-bp__btn"
            onClick={() => setRetryCount((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!error ? (
        <section className="gt-bp__hero" aria-live="polite">
          {selected?.cover_url ? (
            <img className="gt-bp__hero-art" src={coverUrl(selected.cover_url)} alt="" />
          ) : null}
          <div className="gt-bp__hero-body">
            <h2 className="gt-bp__hero-title">{heroTitle}</h2>
            {heroMeta ? <p className="gt-bp__hero-meta">{heroMeta}</p> : null}
            {selected?.summary ? (
              <p className="gt-bp__hero-summary">{String(selected.summary).slice(0, 280)}</p>
            ) : null}
            {selected ? (
              <div className="gt-bp__hero-actions">
                <Link className="gt-bp__btn gt-bp__btn--primary" to={gameDetailsUrl(selected.uuid)}>
                  Open
                </Link>
                <a className="gt-bp__btn" href={downloadUrl(selected.uuid)}>
                  Download
                </a>
                {selected.client_connected && selected.lifecycle_state === 'downloaded' ? (
                  <button
                    type="button"
                    className="gt-bp__btn"
                    onClick={() => {
                      void queueClientCommand(selected.uuid, 'install').then(() => {
                        if (window.$?.notify) {
                          window.$.notify('Install queued for companion', 'success')
                        }
                      })
                    }}
                  >
                    Install
                  </button>
                ) : null}
                <Link className="gt-bp__btn" to="/library">
                  Exit
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!error ? (
        <div className="gt-bp__rail-wrap">
          {loading ? <p className="gt-bp__empty">Loading games…</p> : null}

          {!loading && list.length === 0 ? (
            <p className="gt-bp__empty">No games in your library yet.</p>
          ) : null}

          {!loading && list.length > 0 ? (
            <div
              className="gt-bp__rail"
              role="listbox"
              aria-label="Game rail"
              onKeyDown={onKeyDown}
            >
              {list.map((game, i) => (
                <a
                  key={game.uuid}
                  ref={(element) => {
                    tileRefs.current[i] = element
                  }}
                  className={`gt-bp__tile${i === index ? ' gt-bp__tile--focused' : ''}`}
                  role="option"
                  aria-label={game.name || 'Untitled'}
                  aria-selected={i === index}
                  tabIndex={i === index ? 0 : -1}
                  href={gameDetailsUrl(game.uuid)}
                  data-index={i}
                  onFocus={() => setIndex(i)}
                >
                  <img
                    className="gt-bp__tile-art"
                    src={coverUrl(game.cover_url)}
                    alt=""
                    width={220}
                    height={293}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="gt-bp__tile-badges">
                    {badgeBits(game).map((bit) => (
                      <span key={bit} className="gt-bp__badge">
                        {bit}
                      </span>
                    ))}
                  </span>
                  <span className="gt-bp__tile-label">{game.name || 'Untitled'}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
