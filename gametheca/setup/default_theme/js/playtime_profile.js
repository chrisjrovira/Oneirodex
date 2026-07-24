/**
 * Member playtime profile — aggregates from GET /api/playtime/me.
 */
(function (global) {
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

  function formatDate(iso) {
    if (!iso) {
      return 'Never'
    }
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function setList(el, html) {
    if (el) {
      el.innerHTML = html
    }
  }

  async function init() {
    const totalEl = document.getElementById('gt-playtime-total')
    const countEl = document.getElementById('gt-playtime-game-count')
    const list = document.getElementById('gt-playtime-games')

    try {
      const data = await api('/api/playtime/me')
      const rows = data.games || []
      const totalSeconds = Number(data.total_seconds || 0)

      if (totalEl) {
        totalEl.textContent = formatDuration(totalSeconds)
      }
      if (countEl) {
        countEl.textContent = String(rows.length)
      }

      if (!rows.length) {
        setList(list, '<p class="gt-hub__empty">No playtime recorded yet. Start a session from any game page.</p>')
        return
      }

      setList(
        list,
        rows
          .map(
            (row) => {
              const shareUrl = `/api/playtime/share/${encodeURIComponent(row.game_uuid)}.svg`
              return `<div class="gt-hub__card gt-playtime__row">
              <a href="/game_details/${escapeHtml(row.game_uuid)}">
                <strong>${escapeHtml(row.game_name || row.game_uuid)}</strong>
              </a>
              <span class="gt-hub__meta">
                ${escapeHtml(formatDuration(row.total_seconds))}
                · ${escapeHtml(String(row.session_count || 0))} session${row.session_count === 1 ? '' : 's'}
                · Last played ${escapeHtml(formatDate(row.last_played_at))}
              </span>
              <a class="gt-playtime__share" href="${shareUrl}" target="_blank" rel="noopener">Share card (SVG)</a>
            </div>`
            },
          )
          .join(''),
      )
    } catch (err) {
      setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
      if (totalEl) {
        totalEl.textContent = '—'
      }
      if (countEl) {
        countEl.textContent = '—'
      }
    }
  }

  global.GameThecaPlaytimeProfile = { init }
})(window)
