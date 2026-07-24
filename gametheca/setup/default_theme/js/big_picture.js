/**
 * Big Picture shell — keyboard / gamepad navigation over a browse_games rail.
 */
(function (global) {
  const RAIL_FETCH = '/browse_games?per_page=24&sort_by=date_identified&sort_order=desc'
  const GAMEPAD_DEADZONE = 0.5
  const GAMEPAD_REPEAT_MS = 220

  function csrfHeaders() {
    if (global.CSRFUtils) {
      return CSRFUtils.getHeaders({ 'Content-Type': 'application/json' })
    }
    const meta = document.querySelector('meta[name="csrf-token"]')
    return {
      'Content-Type': 'application/json',
      'X-CSRFToken': meta ? meta.content : '',
    }
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { ...csrfHeaders(), ...(options.headers || {}) },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`)
    }
    return data
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function badgeBits(game) {
    const bits = []
    if (game.owned || game.store_owned) bits.push('OWNED')
    if (game.lifecycle_state === 'update_available' || game.freshness_status === 'behind' || game.freshness_status === 'heuristic_behind') {
      bits.push('UPDATE')
    }
    if (game.client_connected) bits.push('CLIENT')
    return bits
  }

  function focusGameFromQuery() {
    try {
      return new URLSearchParams(window.location.search).get('game') || ''
    } catch (_err) {
      return ''
    }
  }

  function init() {
    const root = document.getElementById('gt-big-picture')
    const rail = document.getElementById('gt-bp-rail')
    const heroTitle = document.getElementById('gt-bp-hero-title')
    const heroMeta = document.getElementById('gt-bp-hero-meta')
    const heroSummary = document.getElementById('gt-bp-hero-summary')
    const heroArt = document.getElementById('gt-bp-hero-art')
    const heroActions = document.getElementById('gt-bp-hero-actions')
    const openBtn = document.getElementById('gt-bp-open')
    const downloadLink = document.getElementById('gt-bp-download')

    if (!root || !rail) {
      return
    }

    let games = []
    let index = 0
    let cards = []
    let gamepadAxisLatch = { x: 0, y: 0 }
    let lastGamepadNav = 0
    let confirmLatch = false
    const preferredUuid = focusGameFromQuery()

    function updateHero(game) {
      if (!game) {
        if (heroTitle) heroTitle.textContent = 'No games'
        if (heroMeta) heroMeta.textContent = ''
        if (heroSummary) heroSummary.textContent = ''
        if (heroActions) heroActions.hidden = true
        if (heroArt) {
          heroArt.hidden = true
          heroArt.style.backgroundImage = ''
        }
        return
      }
      if (heroTitle) heroTitle.textContent = game.name || 'Untitled'
      if (heroMeta) {
        const bits = badgeBits(game)
        const size = game.size ? String(game.size) : ''
        heroMeta.textContent = [bits.join(' · '), size].filter(Boolean).join(' · ')
      }
      if (heroSummary) {
        heroSummary.textContent = (game.summary || '').slice(0, 280)
      }
      if (heroArt) {
        if (game.cover_url) {
          heroArt.hidden = false
          heroArt.style.backgroundImage = `url("${game.cover_url}")`
        } else {
          heroArt.hidden = true
          heroArt.style.backgroundImage = ''
        }
      }
      if (heroActions && downloadLink && openBtn) {
        heroActions.hidden = false
        downloadLink.href = `/download_game/${encodeURIComponent(game.uuid)}`
      }
    }

    function scrollToIndex(nextIndex) {
      if (!games.length) {
        return
      }
      index = Math.max(0, Math.min(games.length - 1, nextIndex))
      cards.forEach((card, i) => {
        const focused = i === index
        card.classList.toggle('gt-bp__tile--focused', focused)
        card.setAttribute('aria-selected', focused ? 'true' : 'false')
        if (focused) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
      })
      updateHero(games[index])
    }

    function openFocused() {
      const game = games[index]
      if (game?.uuid) {
        window.location.href = `/game_details/${encodeURIComponent(game.uuid)}`
      }
    }

    function downloadFocused() {
      const game = games[index]
      if (game?.uuid) {
        window.location.href = `/download_game/${encodeURIComponent(game.uuid)}`
      }
    }

    function openAttract() {
      const game = games[index]
      const qs = new URLSearchParams({ attract_mode: 'true' })
      if (game?.uuid) {
        qs.set('game', game.uuid)
      }
      window.location.href = `/trailers?${qs.toString()}`
    }

    function renderRail() {
      if (!games.length) {
        rail.innerHTML = '<p class="gt-bp__empty">No games in your library yet.</p>'
        cards = []
        updateHero(null)
        return
      }

      rail.innerHTML = games
        .map((game, i) => {
          const badges = badgeBits(game)
            .map((b) => `<span class="gt-bp__badge">${escapeHtml(b)}</span>`)
            .join('')
          return `<button type="button" class="gt-bp__tile" role="option" data-index="${i}" aria-selected="${i === 0 ? 'true' : 'false'}">
            <span class="gt-bp__tile-art"${game.cover_url ? ` style="background-image:url('${escapeHtml(game.cover_url)}')"` : ''}></span>
            <span class="gt-bp__tile-badges">${badges}</span>
            <span class="gt-bp__tile-label">${escapeHtml(game.name || 'Untitled')}</span>
          </button>`
        })
        .join('')

      cards = Array.from(rail.querySelectorAll('.gt-bp__tile'))
      cards.forEach((card) => {
        card.addEventListener('click', () => {
          scrollToIndex(Number(card.dataset.index || 0))
          root.focus()
        })
        card.addEventListener('dblclick', openFocused)
      })

      let startIndex = 0
      if (preferredUuid) {
        const found = games.findIndex((g) => g.uuid === preferredUuid)
        if (found >= 0) startIndex = found
      }
      scrollToIndex(startIndex)
    }

    async function loadGames() {
      try {
        const data = await api(RAIL_FETCH)
        games = data.games || []
        renderRail()
      } catch (err) {
        rail.innerHTML = `<p class="gt-bp__empty">${escapeHtml(err.message)}</p>`
        updateHero(null)
      }
    }

    function onKeyDown(event) {
      if (!games.length && event.key !== 'b' && event.key !== 'B') {
        return
      }
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          scrollToIndex(index + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          scrollToIndex(index - 1)
          break
        case 'Home':
          event.preventDefault()
          scrollToIndex(0)
          break
        case 'End':
          event.preventDefault()
          scrollToIndex(games.length - 1)
          break
        case 'Enter':
          event.preventDefault()
          openFocused()
          break
        case 'd':
        case 'D':
          event.preventDefault()
          downloadFocused()
          break
        case 'b':
        case 'B':
          event.preventDefault()
          openAttract()
          break
        case 'Escape':
          event.preventDefault()
          root.blur()
          break
        default:
          break
      }
    }

    function pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      const pad = pads && pads[0]
      if (!pad || !games.length) {
        requestAnimationFrame(pollGamepad)
        return
      }

      const now = performance.now()
      const axisX = pad.axes[0] || 0
      const axisY = pad.axes[1] || 0
      const dpadLeft = pad.buttons[14]?.pressed
      const dpadRight = pad.buttons[15]?.pressed
      const dpadUp = pad.buttons[12]?.pressed
      const dpadDown = pad.buttons[13]?.pressed
      const confirm = pad.buttons[0]?.pressed
      const west = pad.buttons[2]?.pressed // X / Square → download
      const east = pad.buttons[1]?.pressed // B / Circle → attract

      let dir = 0
      if (axisX <= -GAMEPAD_DEADZONE || dpadLeft || dpadUp) {
        dir = -1
      } else if (axisX >= GAMEPAD_DEADZONE || dpadRight || dpadDown) {
        dir = 1
      }

      if (dir !== 0 && (dir !== gamepadAxisLatch.x || now - lastGamepadNav > GAMEPAD_REPEAT_MS)) {
        scrollToIndex(index + dir)
        gamepadAxisLatch.x = dir
        lastGamepadNav = now
      } else if (dir === 0) {
        gamepadAxisLatch.x = 0
      }

      if (confirm) {
        if (!confirmLatch && now - lastGamepadNav > GAMEPAD_REPEAT_MS) {
          openFocused()
          lastGamepadNav = now
        }
        confirmLatch = true
      } else {
        confirmLatch = false
      }

      if (west && now - lastGamepadNav > GAMEPAD_REPEAT_MS) {
        downloadFocused()
        lastGamepadNav = now
      }

      if (east && now - lastGamepadNav > GAMEPAD_REPEAT_MS) {
        openAttract()
        lastGamepadNav = now
      }

      requestAnimationFrame(pollGamepad)
    }

    openBtn?.addEventListener('click', openFocused)
    root.addEventListener('keydown', onKeyDown)
    root.focus()

    loadGames()
    requestAnimationFrame(pollGamepad)
  }

  global.GameThecaBigPicture = { init }
})(window)
