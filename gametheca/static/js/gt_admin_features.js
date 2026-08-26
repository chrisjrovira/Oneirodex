/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(async function () {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': csrf };
  const status = document.getElementById('challenge-status');

  async function refreshChallengeStatus() {
    try {
      const res = await fetch('/api/admin/challenge-solver/status?probe=1', { credentials: 'same-origin' });
      const data = await res.json();
      status.textContent = `enabled=${data.enabled} provider=${data.provider} reachable=${data.reachable} probe_ok=${data.probe_ok} ${data.last_error || ''}`;
    } catch (e) {
      status.textContent = e.message;
    }
  }

  document.getElementById('challenge-save').onclick = async () => {
    status.textContent = 'Saving…';
    const res = await fetch('/api/admin/challenge-solver/config', {
      method: 'PUT', credentials: 'same-origin', headers,
      body: JSON.stringify({
        enabled: document.getElementById('challenge-enable').checked,
        url: document.getElementById('challenge-url').value.trim(),
        provider: document.getElementById('challenge-provider').value,
        max_tier: parseInt(document.getElementById('challenge-max-tier').value, 10) || 5,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = data.error || 'Save failed';
      return;
    }
    status.textContent = 'Saved. Testing…';
    await refreshChallengeStatus();
  };

  document.getElementById('challenge-test').onclick = refreshChallengeStatus;
})();
