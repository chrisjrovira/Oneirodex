/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(async function () {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': csrf };

  function setMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('text-danger', !!isError);
    el.classList.toggle('text-muted', !isError);
  }

  function renderWarnings(el, warnings) {
    if (!el) return;
    const list = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
    if (!list.length) {
      el.classList.add('d-none');
      el.textContent = '';
      return;
    }
    el.classList.remove('d-none');
    el.className = 'alert alert-warning py-2 px-3 small mb-2';
    el.textContent = '';
    const title = document.createElement('strong');
    title.textContent = 'Indexer warnings: ';
    el.appendChild(title);
    el.appendChild(document.createTextNode(list.join(' · ')));
  }

  document.getElementById('arr-enable-save')?.addEventListener('click', async () => {
    const enabled = document.getElementById('arr-enable').checked;
    const status = document.getElementById('arr-enable-status');
    status.textContent = 'Saving…';
    const res = await fetch('/api/arr/module', {
      method: 'PUT', headers, body: JSON.stringify({ enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = data.error || 'Save failed';
      return;
    }
    status.textContent = `Saved. Effective status: ${data.enabled ? 'on' : 'off'}. Reloading…`;
    window.location.reload();
  });

  if (!document.getElementById('arr-status')) return;
  let presetsCache = [];

  async function refreshStatus() {
    const res = await fetch('/api/arr/status');
    const data = await res.json().catch(() => ({}));
    const el = document.getElementById('arr-status');
    if (el) {
      el.textContent = (data.connectors || []).map(c =>
        `${c.id}: ${c.configured ? 'configured' : 'not configured'}`
      ).join(' · ') || data.message || '';
    }
    renderWarnings(document.getElementById('arr-indexer-warnings'), data.indexer_warnings);
  }

  function renderPresets(presets) {
    const box = document.getElementById('arr-presets');
    if (!box) return;
    box.textContent = '';
    presetsCache = Array.isArray(presets) ? presets : [];
    if (!presetsCache.length) {
      box.innerHTML = '<p class="text-muted small mb-0">No presets available.</p>';
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'row g-1';
    presetsCache.forEach((p) => {
      const col = document.createElement('div');
      col.className = 'col-md-4 col-lg-3';
      const id = `preset-${p.id}`;
      const check = document.createElement('div');
      check.className = 'form-check';
      const input = document.createElement('input');
      input.className = 'form-check-input';
      input.type = 'checkbox';
      input.id = id;
      input.value = p.id;
      input.dataset.presetId = p.id;
      const label = document.createElement('label');
      label.className = 'form-check-label small';
      label.htmlFor = id;
      label.textContent = `${p.name || p.id} (${p.protocol || 'torznab'})`;
      if (p.notes) label.title = p.notes;
      check.appendChild(input);
      check.appendChild(label);
      col.appendChild(check);
      wrap.appendChild(col);
    });
    box.appendChild(wrap);
  }

  function renderIndexers(indexers) {
    const tbody = document.getElementById('arr-indexer-tbody');
    if (!tbody) return;
    tbody.textContent = '';
    const rows = Array.isArray(indexers) ? indexers : [];
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'text-muted';
      td.textContent = 'No native indexers yet. Add one, import bulk, or enable presets.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const cells = [
        row.name || '—',
        row.protocol || '—',
        row.url || '—',
        row.ready ? 'yes' : 'no',
        null,
        row.source || 'manual',
      ];
      cells.forEach((text, i) => {
        const td = document.createElement('td');
        if (i === 4) {
          const toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.className = 'form-check-input';
          toggle.checked = !!row.enabled;
          toggle.title = 'Toggle enabled';
          toggle.addEventListener('change', async () => {
            const res = await fetch(`/api/arr/indexers/${encodeURIComponent(row.id)}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ enabled: toggle.checked }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              toggle.checked = !toggle.checked;
              setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Toggle failed', true);
              return;
            }
            setMsg(document.getElementById('arr-indexer-msg'), 'Updated');
            loadIndexers();
            refreshStatus();
          });
          td.appendChild(toggle);
        } else {
          td.textContent = text;
          if (i === 2) td.className = 'small text-break';
        }
        tr.appendChild(td);
      });
      const actions = document.createElement('td');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-sm btn-outline-danger';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!confirm(`Delete indexer “${row.name || row.id}”?`)) return;
        const res = await fetch(`/api/arr/indexers/${encodeURIComponent(row.id)}`, {
          method: 'DELETE', headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Delete failed', true);
          return;
        }
        setMsg(document.getElementById('arr-indexer-msg'), 'Deleted');
        loadIndexers();
        refreshStatus();
      });
      actions.appendChild(del);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
  }

  async function loadIndexers() {
    const res = await fetch('/api/arr/indexers');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Failed to load indexers', true);
      return;
    }
    renderIndexers(data.indexers);
    renderPresets(data.presets);
  }

  document.getElementById('idx-add')?.addEventListener('click', async () => {
    const body = {
      name: document.getElementById('idx-name').value.trim(),
      protocol: document.getElementById('idx-protocol').value,
      url: document.getElementById('idx-url').value.trim(),
      api_key: document.getElementById('idx-api-key').value,
      enabled: true,
    };
    const res = await fetch('/api/arr/indexers', {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Add failed', true);
      return;
    }
    document.getElementById('idx-name').value = '';
    document.getElementById('idx-url').value = '';
    document.getElementById('idx-api-key').value = '';
    setMsg(document.getElementById('arr-indexer-msg'), 'Indexer added');
    loadIndexers();
    refreshStatus();
  });

  document.getElementById('idx-bulk-import')?.addEventListener('click', async () => {
    const raw = (document.getElementById('idx-bulk').value || '').trim();
    if (!raw) {
      setMsg(document.getElementById('arr-indexer-msg'), 'Paste JSON or CSV first', true);
      return;
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch (_) {
      body = { text: raw };
    }
    const res = await fetch('/api/arr/indexers/bulk', {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Import failed', true);
      return;
    }
    setMsg(document.getElementById('arr-indexer-msg'), `Imported ${data.count || 0}`);
    document.getElementById('idx-bulk').value = '';
    loadIndexers();
    refreshStatus();
  });

  document.getElementById('idx-enable-presets')?.addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('#arr-presets input[type="checkbox"]:checked')]
      .map((el) => el.dataset.presetId || el.value)
      .filter(Boolean);
    if (!ids.length) {
      setMsg(document.getElementById('arr-indexer-msg'), 'Select at least one preset', true);
      return;
    }
    const res = await fetch('/api/arr/indexers/enable-presets', {
      method: 'POST', headers, body: JSON.stringify({ preset_ids: ids }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(document.getElementById('arr-indexer-msg'), data.error || 'Enable presets failed', true);
      return;
    }
    setMsg(document.getElementById('arr-indexer-msg'), `Enabled ${data.count || 0} preset(s) — set API keys before search`);
    loadIndexers();
    refreshStatus();
  });

  async function loadConfig() {
    const res = await fetch('/api/arr/config');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('prowlarr_url').value = data.prowlarr_url || '';
    document.getElementById('jackett_url').value = data.jackett_url || '';
    document.getElementById('qbittorrent_url').value = data.qbittorrent_url || '';
    document.getElementById('qbittorrent_username').value = data.qbittorrent_username || 'admin';
    document.getElementById('transmission_url').value = data.transmission_url || '';
    document.getElementById('transmission_username').value = data.transmission_username || '';
    document.getElementById('sabnzbd_url').value = data.sabnzbd_url || '';
    document.getElementById('nzbget_url').value = data.nzbget_url || '';
    document.getElementById('nzbget_username').value = data.nzbget_username || '';
  }

  document.getElementById('arr-save')?.addEventListener('click', async () => {
    const body = {
      prowlarr_url: document.getElementById('prowlarr_url').value,
      jackett_url: document.getElementById('jackett_url').value,
      qbittorrent_url: document.getElementById('qbittorrent_url').value,
      qbittorrent_username: document.getElementById('qbittorrent_username').value,
      transmission_url: document.getElementById('transmission_url').value,
      transmission_username: document.getElementById('transmission_username').value,
      sabnzbd_url: document.getElementById('sabnzbd_url').value,
      nzbget_url: document.getElementById('nzbget_url').value,
      nzbget_username: document.getElementById('nzbget_username').value,
    };
    const prowKey = document.getElementById('prowlarr_api_key').value;
    const jackKey = document.getElementById('jackett_api_key').value;
    const qbitPass = document.getElementById('qbittorrent_password').value;
    const txPass = document.getElementById('transmission_password').value;
    const sabKey = document.getElementById('sabnzbd_api_key').value;
    const nzbPass = document.getElementById('nzbget_password').value;
    if (prowKey) body.prowlarr_api_key = prowKey;
    if (jackKey) body.jackett_api_key = jackKey;
    if (qbitPass) body.qbittorrent_password = qbitPass;
    if (txPass) body.transmission_password = txPass;
    if (sabKey) body.sabnzbd_api_key = sabKey;
    if (nzbPass) body.nzbget_password = nzbPass;
    const res = await fetch('/api/arr/config', { method: 'PUT', headers, body: JSON.stringify(body) });
    alert(res.ok ? 'Saved' : 'Save failed');
    refreshStatus();
  });

  document.getElementById('arr-search')?.addEventListener('click', async () => {
    const q = document.getElementById('arr-query').value.trim();
    const box = document.getElementById('arr-results');
    box.innerHTML = 'Searching…';
    const res = await fetch('/api/arr/search?q=' + encodeURIComponent(q));
    const data = await res.json().catch(() => ({}));
    renderWarnings(document.getElementById('arr-search-warnings'), data.warnings);
    if (!res.ok) {
      box.textContent = data.error || 'Search failed';
      return;
    }
    box.textContent = '';
    const results = data.results || [];
    if (!results.length) {
      box.textContent = 'No results';
      return;
    }
    results.forEach((r) => {
      const wrap = document.createElement('div');
      wrap.className = 'border rounded p-2 mb-2';
      const title = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = r.title || 'Untitled';
      title.appendChild(strong);
      const score = document.createElement('span');
      score.className = 'text-muted';
      score.textContent = ` score ${r.quality?.score ?? 0}`;
      title.appendChild(score);
      const meta = document.createElement('div');
      meta.className = 'small text-muted';
      meta.textContent = `${r.indexer || ''} · seeders ${r.seeders ?? '—'}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-primary mt-1';
      btn.textContent = 'Send to qBittorrent';
      btn.dataset.url = r.download_url || '';
      wrap.appendChild(title);
      wrap.appendChild(meta);
      wrap.appendChild(btn);
      box.appendChild(wrap);
    });
    box.querySelectorAll('button[data-url]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        if (!url) return alert('No download URL');
        const r = await fetch('/api/arr/download', {
          method: 'POST', headers, body: JSON.stringify({ download_url: url }),
        });
        const j = await r.json();
        alert(r.ok ? 'Queued' : (j.error || 'Failed'));
      });
    });
  });

  let lastProposals = [];
  document.getElementById('arr-hl-preview')?.addEventListener('click', async () => {
    const out = document.getElementById('arr-hl-out');
    const dest = document.getElementById('arr-hl-dest').value.trim();
    out.textContent = 'Previewing…';
    const res = await fetch('/api/arr/hardlink/preview', {
      method: 'POST', headers, body: JSON.stringify({ library_dest_dir: dest }),
    });
    const data = await res.json();
    lastProposals = data.proposals || [];
    out.textContent = JSON.stringify(data, null, 2);
  });
  document.getElementById('arr-hl-apply')?.addEventListener('click', async () => {
    const out = document.getElementById('arr-hl-out');
    const dest = document.getElementById('arr-hl-dest').value.trim();
    out.textContent = 'Applying…';
    const body = lastProposals.length
      ? { proposals: lastProposals, only_ok: true }
      : { library_dest_dir: dest, only_ok: true };
    const res = await fetch('/api/arr/hardlink/apply', {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    out.textContent = JSON.stringify(await res.json(), null, 2);
  });

  loadConfig();
  loadIndexers();
  refreshStatus();
})();
