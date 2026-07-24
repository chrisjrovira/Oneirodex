/**
 * GameTheca playtime session controls (Start / Stop + heartbeat).
 * Expects a root element:
 *   <div id="gt-playtime"
 *        data-game-uuid="..."
 *        data-total-seconds="0"
 *        data-session-count="0">
 */
(function () {
  const HEARTBEAT_MS = 60000

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, '0')}m`
    }
    if (m > 0) {
      return `${m}m ${String(s).padStart(2, '0')}s`
    }
    return `${s}s`
  }

  function csrfHeaders() {
    if (window.CSRFUtils) {
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
      headers: {
        ...csrfHeaders(),
        ...(options.headers || {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`)
    }
    return data
  }

  function initPlaytimePanel(root) {
    if (!root || root.dataset.bound === '1') {
      return
    }
    root.dataset.bound = '1'

    const gameUuid = root.dataset.gameUuid
    const totalEl = root.querySelector('[data-playtime-total]')
    const sessionsEl = root.querySelector('[data-playtime-sessions]')
    const liveEl = root.querySelector('[data-playtime-live]')
    const startBtn = root.querySelector('[data-playtime-start]')
    const stopBtn = root.querySelector('[data-playtime-stop]')

    let sessionId = null
    let heartbeatTimer = null
    let tickTimer = null
    let liveSeconds = 0
    let totalSeconds = Number(root.dataset.totalSeconds || 0)
    let sessionCount = Number(root.dataset.sessionCount || 0)

    function renderTotals() {
      if (totalEl) {
        totalEl.textContent = formatDuration(totalSeconds)
      }
      if (sessionsEl) {
        sessionsEl.textContent = String(sessionCount)
      }
    }

    function setActive(active) {
      root.dataset.active = active ? '1' : '0'
      if (startBtn) {
        startBtn.disabled = active
        startBtn.hidden = active
      }
      if (stopBtn) {
        stopBtn.disabled = !active
        stopBtn.hidden = !active
      }
      if (liveEl) {
        liveEl.hidden = !active
        if (active) {
          liveEl.textContent = `Live: ${formatDuration(liveSeconds)}`
        }
      }
    }

    function clearTimers() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
      if (tickTimer) {
        clearInterval(tickTimer)
        tickTimer = null
      }
    }

    async function startSession() {
      if (!gameUuid || sessionId) {
        return
      }
      startBtn.disabled = true
      try {
        const session = await api('/api/playtime/sessions', {
          method: 'POST',
          body: JSON.stringify({ game_uuid: gameUuid, client: 'web' }),
        })
        sessionId = session.id
        liveSeconds = Number(session.duration_seconds || 0)
        setActive(true)
        heartbeatTimer = setInterval(async () => {
          if (!sessionId) {
            return
          }
          try {
            const updated = await api(`/api/playtime/sessions/${sessionId}/heartbeat`, {
              method: 'POST',
              body: '{}',
            })
            liveSeconds = Number(updated.duration_seconds || liveSeconds)
            if (liveEl) {
              liveEl.textContent = `Live: ${formatDuration(liveSeconds)}`
            }
          } catch (err) {
            console.warn('Playtime heartbeat failed', err)
          }
        }, HEARTBEAT_MS)
        tickTimer = setInterval(() => {
          liveSeconds += 1
          if (liveEl) {
            liveEl.textContent = `Live: ${formatDuration(liveSeconds)}`
          }
        }, 1000)
      } catch (err) {
        console.error(err)
        startBtn.disabled = false
        if (window.Notify) {
          Notify.create({ title: 'Playtime', text: err.message, status: 'error' })
        }
      }
    }

    async function stopSession() {
      if (!sessionId) {
        return
      }
      stopBtn.disabled = true
      const activeId = sessionId
      clearTimers()
      try {
        const session = await api(`/api/playtime/sessions/${activeId}/stop`, {
          method: 'POST',
          body: '{}',
        })
        totalSeconds += Number(session.duration_seconds || 0)
        sessionCount += 1
        root.dataset.totalSeconds = String(totalSeconds)
        root.dataset.sessionCount = String(sessionCount)
        sessionId = null
        liveSeconds = 0
        renderTotals()
        setActive(false)
      } catch (err) {
        console.error(err)
        stopBtn.disabled = false
        if (window.Notify) {
          Notify.create({ title: 'Playtime', text: err.message, status: 'error' })
        }
      }
    }

    startBtn?.addEventListener('click', (event) => {
      event.preventDefault()
      startSession()
    })
    stopBtn?.addEventListener('click', (event) => {
      event.preventDefault()
      stopSession()
    })

    window.addEventListener('beforeunload', () => {
      if (!sessionId) {
        return
      }
      // Best-effort stop; keepalive for page unload
      const token = window.CSRFUtils ? CSRFUtils.getToken() : null
      navigator.sendBeacon?.(
        `/api/playtime/sessions/${sessionId}/stop`,
        new Blob([JSON.stringify({})], { type: 'application/json' }),
      )
      // Fallback fetch (may be cancelled)
      fetch(`/api/playtime/sessions/${sessionId}/stop`, {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-CSRFToken': token } : {}),
        },
        body: '{}',
      }).catch(() => {})
    })

    renderTotals()
    setActive(false)
  }

  function boot() {
    document.querySelectorAll('#gt-playtime, [data-gt-playtime]').forEach(initPlaytimePanel)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
