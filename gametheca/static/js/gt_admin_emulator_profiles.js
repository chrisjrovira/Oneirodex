/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  const statusEl = document.getElementById('gt-emu-status');
  const listEl = document.getElementById('gt-emu-profiles');

  function headers() {
    if (window.CSRFUtils) return CSRFUtils.getHeaders({ 'Content-Type': 'application/json' });
    const meta = document.querySelector('meta[name="csrf-token"]');
    return { 'Content-Type': 'application/json', 'X-CSRFToken': meta ? meta.content : '' };
  }

  function render(catalog, profiles) {
    const platforms = Object.keys(catalog || {}).sort();
    if (!platforms.length) {
      listEl.innerHTML = '<p class="text-muted">No emulator platforms available.</p>';
      return;
    }
    listEl.innerHTML = platforms.map((platform) => {
      const cores = catalog[platform] || [];
      const preferred = profiles[platform] || '';
      const options = ['<option value="">Default (first core)</option>']
        .concat(cores.map((c) => `<option value="${c}" ${c === preferred ? 'selected' : ''}>${c}</option>`))
        .join('');
      return `<div class="gt-emu-row mb-2 d-flex gap-2 align-items-center flex-wrap">
        <label style="min-width:140px" for="emu-${platform}"><strong>${platform}</strong></label>
        <select id="emu-${platform}" data-platform="${platform}" class="form-select" style="max-width:280px">${options}</select>
      </div>`;
    }).join('') + `<button type="button" class="btn btn-primary mt-2" id="gt-emu-save">Save profiles</button>`;

    document.getElementById('gt-emu-save')?.addEventListener('click', save);
  }

  async function load() {
    try {
      const resp = await fetch('/api/emulator-profiles', { credentials: 'same-origin', headers: headers() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load');
      render(data.catalog || {}, data.profiles || {});
    } catch (err) {
      listEl.innerHTML = `<p class="text-danger">${err.message}</p>`;
    }
  }

  async function save() {
    const profiles = {};
    listEl.querySelectorAll('select[data-platform]').forEach((sel) => {
      profiles[sel.dataset.platform] = sel.value || null;
    });
    statusEl.textContent = 'Saving…';
    try {
      const resp = await fetch('/api/emulator-profiles', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: headers(),
        body: JSON.stringify({ profiles }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      statusEl.textContent = 'Saved.';
      render(data.catalog || (await (await fetch('/api/emulator-profiles', { headers: headers() })).json()).catalog, data.profiles || {});
    } catch (err) {
      statusEl.textContent = err.message;
    }
  }

  load();
})();
