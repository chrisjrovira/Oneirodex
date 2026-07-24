/**
 * GameTheca member hub pages: collections, news, wishlist, updates.
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

  function setList(el, html) {
    if (el) {
      el.innerHTML = html
    }
  }

  async function initCollections() {
    const list = document.getElementById('gt-collections-list')
    const form = document.getElementById('gt-collection-create')

    async function refresh() {
      try {
        const data = await api('/api/collections')
        const rows = data.collections || []
        if (!rows.length) {
          setList(list, '<p class="gt-hub__empty">No collections yet. Create one above.</p>')
          return
        }
        setList(
          list,
          rows
            .map(
              (c) => `<a class="gt-hub__card" href="/collections/${escapeHtml(c.uuid)}">
                <strong>${escapeHtml(c.name)}</strong>
                <span>${escapeHtml(c.description || 'No description')}</span>
                <span class="gt-hub__meta">${c.is_public ? 'Public' : 'Private'}</span>
              </a>`,
            )
            .join(''),
        )
      } catch (err) {
        setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
      }
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(form)
      try {
        await api('/api/collections', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name'),
            description: fd.get('description'),
            is_public: fd.get('is_public') === 'on',
          }),
        })
        form.reset()
        form.querySelector('[name="is_public"]').checked = true
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    await refresh()
  }

  async function initCollectionDetail(uuid) {
    const list = document.getElementById('gt-collection-items')
    const title = document.getElementById('gt-collection-title')
    const desc = document.getElementById('gt-collection-desc')
    try {
      const data = await api(`/api/collections/${encodeURIComponent(uuid)}`)
      if (title) title.textContent = data.name || 'Collection'
      if (desc) desc.textContent = data.description || ''
      const items = data.items || []
      if (!items.length) {
        setList(list, '<p class="gt-hub__empty">No games in this collection yet.</p>')
        return
      }
      setList(
        list,
        items
          .map(
            (item) => `<a class="gt-hub__card" href="/game_details/${escapeHtml(item.game_uuid)}">
              <strong>${escapeHtml(item.game_name || item.game_uuid)}</strong>
              <span class="gt-hub__meta">Open game</span>
            </a>`,
          )
          .join(''),
      )
    } catch (err) {
      setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
    }
  }

  async function initAnnouncements(isAdmin) {
    const list = document.getElementById('gt-announcements-list')
    const form = document.getElementById('gt-announcement-create')

    async function refresh() {
      try {
        const data = await api('/api/announcements')
        const rows = data.announcements || []
        if (!rows.length) {
          setList(list, '<p class="gt-hub__empty">No announcements yet.</p>')
          return
        }
        setList(
          list,
          rows
            .map(
              (a) => `<article class="gt-hub__card">
                <strong>${escapeHtml(a.title)}</strong>
                <p>${escapeHtml(a.body)}</p>
                <span class="gt-hub__meta">${escapeHtml((a.created_at || '').slice(0, 10))}</span>
              </article>`,
            )
            .join(''),
        )
      } catch (err) {
        setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
      }
    }

    if (isAdmin && form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const fd = new FormData(form)
        try {
          await api('/api/announcements', {
            method: 'POST',
            body: JSON.stringify({
              title: fd.get('title'),
              body: fd.get('body'),
              published: true,
            }),
          })
          form.reset()
          await refresh()
        } catch (err) {
          alert(err.message)
        }
      })
    }

    await refresh()
  }

  async function initWishlist(isLibrarian) {
    const list = document.getElementById('gt-wishlist-list')
    const form = document.getElementById('gt-wishlist-create')
    const allToggle = document.getElementById('gt-wishlist-all')

    async function refresh() {
      const showAll = isLibrarian && allToggle?.checked
      const url = showAll ? '/api/requests?all=1' : '/api/requests'
      try {
        const data = await api(url)
        const rows = data.requests || []
        if (!rows.length) {
          setList(list, '<p class="gt-hub__empty">No requests yet.</p>')
          return
        }
        setList(
          list,
          rows
            .map((r) => {
              const adminControls = isLibrarian
                ? `<div class="gt-hub__actions">
                    <button type="button" data-resolve="${r.id}" data-status="approved">Approve</button>
                    <button type="button" data-resolve="${r.id}" data-status="rejected">Reject</button>
                    <button type="button" data-resolve="${r.id}" data-status="fulfilled">Fulfilled</button>
                  </div>`
                : ''
              return `<article class="gt-hub__card" data-request-id="${r.id}">
                <strong>${escapeHtml(r.title)}</strong>
                <span>${escapeHtml(r.notes || '')}</span>
                <span class="gt-hub__meta">${escapeHtml(r.status)}</span>
                ${adminControls}
              </article>`
            })
            .join(''),
        )
      } catch (err) {
        setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
      }
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(form)
      try {
        await api('/api/requests', {
          method: 'POST',
          body: JSON.stringify({
            title: fd.get('title'),
            notes: fd.get('notes'),
          }),
        })
        form.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    allToggle?.addEventListener('change', refresh)

    list?.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-resolve]')
      if (!btn) return
      try {
        await api(`/api/requests/${btn.dataset.resolve}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: btn.dataset.status }),
        })
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    await refresh()
  }

  async function initUpdatesInbox() {
    const list = document.getElementById('gt-updates-list')
    try {
      const data = await api('/api/updates/inbox?limit=100')
      const rows = data.items || []
      if (!rows.length) {
        setList(list, '<p class="gt-hub__empty">No outdated titles detected. Nice.</p>')
        return
      }
      setList(
        list,
        rows
          .map(
            (g) => `<a class="gt-hub__card" href="/game_details/${escapeHtml(g.uuid)}">
              <strong>${escapeHtml(g.name)}</strong>
              <span class="gt-hub__meta">${escapeHtml(g.freshness_status)} · ${escapeHtml(g.local_version || 'local?')} → ${escapeHtml(g.remote_version_summary || 'store?')}</span>
            </a>`,
          )
          .join(''),
      )
    } catch (err) {
      setList(list, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
    }
  }

  async function initOwnership() {
    const statusEl = document.getElementById('gt-ownership-status')
    const storeSections = [
      document.getElementById('gt-ownership-steam-section'),
      document.getElementById('gt-ownership-gog-section'),
      document.getElementById('gt-ownership-epic-section'),
    ]
    const steamConnect = document.getElementById('gt-ownership-steam-connect')
    const steamCsv = document.getElementById('gt-ownership-steam-csv')
    const steamSync = document.getElementById('gt-ownership-steam-sync')
    const steamDisconnect = document.getElementById('gt-ownership-steam-disconnect')
    const gogConnect = document.getElementById('gt-ownership-gog-connect')
    const gogCsv = document.getElementById('gt-ownership-gog-csv')
    const gogDisconnect = document.getElementById('gt-ownership-gog-disconnect')
    const epicConnect = document.getElementById('gt-ownership-epic-connect')
    const epicCsv = document.getElementById('gt-ownership-epic-csv')
    const epicDisconnect = document.getElementById('gt-ownership-epic-disconnect')

    function storeLine(label, store) {
      const connected = store.connected ? 'connected' : 'not connected'
      return `<span class="gt-hub__meta">${label}: ${connected} · ${store.owned_count ?? 0} titles · ${store.matched_count ?? 0} matched</span>`
    }

    function renderSummary(data) {
      if (!data.enabled) {
        setList(
          statusEl,
          '<p class="gt-hub__empty">Store ownership sync is disabled by your administrator.</p>',
        )
        storeSections.forEach((section) => section?.classList.add('gt-hub__hidden'))
        return
      }
      storeSections.forEach((section) => section?.classList.remove('gt-hub__hidden'))

      const steam = (data.stores && data.stores.steam) || {}
      const gog = (data.stores && data.stores.gog) || {}
      const epic = (data.stores && data.stores.epic) || {}

      const steamInput = steamConnect?.querySelector('[name="steam_id"]')
      if (steamInput && steam.external_account_id) {
        steamInput.value = steam.external_account_id
      }
      const gogInput = gogConnect?.querySelector('[name="gog_user_id"]')
      if (gogInput && gog.external_account_id) {
        gogInput.value = gog.external_account_id
      }
      const epicInput = epicConnect?.querySelector('[name="epic_account_id"]')
      if (epicInput && epic.external_account_id) {
        epicInput.value = epic.external_account_id
      }

      setList(
        statusEl,
        `<article class="gt-hub__card">
          <strong>Owned titles (register-only)</strong>
          <span>${data.total_owned ?? 0} synced · ${data.total_matched ?? 0} matched to library</span>
          ${storeLine('Steam', steam)}
          ${storeLine('GOG', gog)}
          ${storeLine('Epic', epic)}
          <span class="gt-hub__meta">${data.has_steam_api_key ? 'Steam API key configured' : 'Steam: no API key — use CSV import'}</span>
          <span class="gt-hub__meta">GOG/Epic: CSV import only — no store downloads</span>
        </article>`,
      )
    }

    async function refresh() {
      try {
        const data = await api('/api/ownership')
        renderSummary(data)
      } catch (err) {
        setList(statusEl, `<p class="gt-hub__empty">${escapeHtml(err.message)}</p>`)
      }
    }

    steamConnect?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(steamConnect)
      try {
        await api('/api/ownership/steam', {
          method: 'POST',
          body: JSON.stringify({ steam_id: fd.get('steam_id') }),
        })
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    steamSync?.addEventListener('click', async () => {
      try {
        const result = await api('/api/ownership/steam/sync', { method: 'POST' })
        alert(`Synced ${result.synced} titles (${result.matched} matched to library).`)
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    steamDisconnect?.addEventListener('click', async () => {
      if (!window.confirm('Remove Steam link and clear synced Steam ownership?')) return
      try {
        await api('/api/ownership/steam', { method: 'DELETE' })
        steamConnect?.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    steamCsv?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(steamCsv)
      try {
        const result = await api('/api/ownership/steam/csv', {
          method: 'POST',
          body: JSON.stringify({ csv: fd.get('csv') }),
        })
        alert(`Imported ${result.imported} app IDs (${result.matched} matched).`)
        steamCsv.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    gogConnect?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(gogConnect)
      try {
        await api('/api/ownership/gog', {
          method: 'POST',
          body: JSON.stringify({ gog_user_id: fd.get('gog_user_id') }),
        })
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    gogDisconnect?.addEventListener('click', async () => {
      if (!window.confirm('Remove GOG link and clear imported GOG ownership?')) return
      try {
        await api('/api/ownership/gog', { method: 'DELETE' })
        gogConnect?.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    gogCsv?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(gogCsv)
      try {
        const result = await api('/api/ownership/gog/csv', {
          method: 'POST',
          body: JSON.stringify({ csv: fd.get('csv') }),
        })
        alert(`Imported ${result.imported} GOG titles (${result.matched} matched).`)
        gogCsv.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    epicConnect?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(epicConnect)
      try {
        await api('/api/ownership/epic', {
          method: 'POST',
          body: JSON.stringify({ epic_account_id: fd.get('epic_account_id') }),
        })
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    epicDisconnect?.addEventListener('click', async () => {
      if (!window.confirm('Remove Epic link and clear imported Epic ownership?')) return
      try {
        await api('/api/ownership/epic', { method: 'DELETE' })
        epicConnect?.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    epicCsv?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(epicCsv)
      try {
        const result = await api('/api/ownership/epic/csv', {
          method: 'POST',
          body: JSON.stringify({ csv: fd.get('csv') }),
        })
        alert(`Imported ${result.imported} Epic titles (${result.matched} matched).`)
        epicCsv.reset()
        await refresh()
      } catch (err) {
        alert(err.message)
      }
    })

    await refresh()
  }

  global.GameThecaMemberHub = {
    initCollections,
    initCollectionDetail,
    initAnnouncements,
    initWishlist,
    initUpdatesInbox,
    initOwnership,
  }
})(window)
