/**
 * Integrations → Metadata providers (Steam / GOG / Epic toggles).
 * API: GET|PUT /api/admin/integrations/metadata-providers
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/admin/integrations/metadata-providers';
  const PROVIDERS = ['steam', 'gog', 'epic'];

  function checkbox(id) {
    return document.getElementById('mp_' + id);
  }

  function setStatus(message, kind) {
    const el = document.getElementById('metadataProvidersSaveStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'mt-2' + (kind === 'error' ? ' text-danger' : kind === 'ok' ? ' text-success' : '');
  }

  function applyConfig(data) {
    const flags = (data && data.providers) || {};
    const notes = (data && data.notes) || {};
    PROVIDERS.forEach(function (id) {
      const input = checkbox(id);
      if (input) input.checked = flags[id] !== false;
      const noteEl = document.getElementById('mp_' + id + '_note');
      if (noteEl && notes[id]) noteEl.textContent = notes[id];
    });
  }

  function readFlags() {
    const out = {};
    PROVIDERS.forEach(function (id) {
      const input = checkbox(id);
      out[id] = !!(input && input.checked);
    });
    return out;
  }

  function load() {
    fetch(ENDPOINT, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(applyConfig)
      .catch(function (err) {
        setStatus('Could not load provider toggles (' + err.message + ').', 'error');
      });
  }

  function save() {
    const btn = document.getElementById('metadataProvidersSaveBtn');
    if (btn) btn.disabled = true;
    setStatus('Saving…');
    fetch(ENDPOINT, {
      method: 'PUT',
      credentials: 'same-origin',
      // csrf-utils.js owns the token lookup — a local copy here would be the
      // twelfth spelling of it, and it silently sent an empty header when the
      // meta tag moved.
      headers: CSRFUtils.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ providers: readFlags() }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error((body && (body.error || body.message)) || ('HTTP ' + res.status));
          }
          return body;
        });
      })
      .then(function (body) {
        applyConfig(body);
        setStatus('Saved.', 'ok');
      })
      .catch(function (err) {
        setStatus(err.message || 'Save failed.', 'error');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('metadata-providers-panel')) return;
    load();
    const btn = document.getElementById('metadataProvidersSaveBtn');
    if (btn) btn.addEventListener('click', save);
  });
})();
