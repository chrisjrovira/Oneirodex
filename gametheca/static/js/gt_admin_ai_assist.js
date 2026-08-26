/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(async function () {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': csrf };
  const out = document.getElementById('ai-out');
  const status = document.getElementById('ai-status');

  async function refreshStatus() {
    try {
      const res = await fetch('/api/ai/status', { credentials: 'same-origin' });
      const data = await res.json();
      status.textContent = `enabled=${data.enabled} auto_apply=${data.auto_apply_enabled} reachable=${data.reachable} model=${data.model || '—'} ${data.error || ''}`;
    } catch (e) {
      status.textContent = e.message;
    }
  }

  document.getElementById('ai-config-save').onclick = async () => {
    status.textContent = 'Saving…';
    const res = await fetch('/api/ai/config', {
      method: 'PUT', credentials: 'same-origin', headers,
      body: JSON.stringify({
        enabled: document.getElementById('ai-enable').checked,
        ollama_base_url: document.getElementById('ai-ollama-url').value.trim(),
        ollama_model: document.getElementById('ai-ollama-model').value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = data.error || 'Save failed';
      return;
    }
    status.textContent = `Saved. enabled=${data.enabled}. Testing…`;
    await refreshStatus();
  };

  document.getElementById('ai-config-test').onclick = refreshStatus;

  document.getElementById('ai-triage').onclick = async () => {
    const res = await fetch('/api/ai/triage', {
      method: 'POST', credentials: 'same-origin', headers,
      body: JSON.stringify({ name: document.getElementById('ai-name').value.trim() }),
    });
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    const first = (data.suggestions || [])[0];
    if (first && first.title) {
      document.getElementById('ai-apply-title').value = first.title;
    }
  };
  document.getElementById('ai-apply').onclick = async () => {
    const res = await fetch('/api/ai/apply-triage', {
      method: 'POST', credentials: 'same-origin', headers,
      body: JSON.stringify({
        game_uuid: document.getElementById('ai-apply-uuid').value.trim(),
        title: document.getElementById('ai-apply-title').value.trim(),
      }),
    });
    out.textContent = JSON.stringify(await res.json(), null, 2);
  };
  document.getElementById('ai-doctor').onclick = async () => {
    const issues = document.getElementById('ai-issues').value.split(',').map(s => s.trim()).filter(Boolean);
    const res = await fetch('/api/ai/doctor-notes', {
      method: 'POST', credentials: 'same-origin', headers,
      body: JSON.stringify({
        game_uuid: document.getElementById('ai-game').value.trim() || undefined,
        issues,
      }),
    });
    out.textContent = JSON.stringify(await res.json(), null, 2);
  };

  refreshStatus();
})();
