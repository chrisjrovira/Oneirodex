/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(async function () {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': csrf };
  const list = document.getElementById('dl-list');
  const status = document.getElementById('dl-status');
  let sections = [];

  function render() {
    list.innerHTML = sections.map((s, i) => `
      <li class="list-group-item d-flex align-items-center gap-2" data-id="${s.id}">
        <strong style="min-width:120px">${s.id}</strong>
        <label class="mb-0"><input type="checkbox" ${s.visible ? 'checked' : ''}> visible</label>
        <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" data-up ${i === 0 ? 'disabled' : ''}>Up</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-down ${i === sections.length - 1 ? 'disabled' : ''}>Down</button>
      </li>
    `).join('');
    list.querySelectorAll('li').forEach((li, i) => {
      li.querySelector('input').addEventListener('change', (e) => { sections[i].visible = e.target.checked; });
      li.querySelector('[data-up]')?.addEventListener('click', () => {
        if (i === 0) return;
        [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]];
        render();
      });
      li.querySelector('[data-down]')?.addEventListener('click', () => {
        if (i >= sections.length - 1) return;
        [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]];
        render();
      });
    });
  }

  const res = await fetch('/api/layouts/detail', { credentials: 'same-origin' });
  const data = await res.json();
  sections = data.sections || [];
  status.textContent = res.ok ? 'Loaded' : (data.error || 'Failed');
  render();

  document.getElementById('dl-save').onclick = async () => {
    const r = await fetch('/api/layouts/detail', {
      method: 'PUT', credentials: 'same-origin', headers,
      body: JSON.stringify({ sections }),
    });
    const j = await r.json();
    status.textContent = r.ok ? 'Saved' : (j.error || 'Save failed');
    if (r.ok) sections = j.sections || sections;
    render();
  };
  document.getElementById('dl-reset').onclick = async () => {
    const r = await fetch('/api/layouts/detail', {
      method: 'PUT', credentials: 'same-origin', headers,
      body: JSON.stringify({ sections: [] }),
    });
    const j = await r.json();
    if (r.ok) { sections = j.sections || []; status.textContent = 'Reset'; render(); }
  };
})();
