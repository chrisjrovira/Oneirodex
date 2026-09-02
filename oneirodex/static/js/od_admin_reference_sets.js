/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  function csrfHeaders(extra) {
    var headers = extra || { 'Content-Type': 'application/json' };
    if (window.CSRFUtils && window.CSRFUtils.getHeaders) {
      return window.CSRFUtils.getHeaders(headers);
    }
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) headers['X-CSRFToken'] = meta.content;
    return headers;
  }

  var btn = document.getElementById('rehash-btn');
  var sel = document.getElementById('rehash-platform');
  var status = document.getElementById('rehash-status');
  if (btn && sel && status) {
    btn.addEventListener('click', function () {
      status.textContent = 'Hashing…';
      fetch('/api/reference-sets/rehash', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ library_platform: sel.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            status.textContent = res.j.error || 'Rehash failed';
            return;
          }
          status.textContent = 'Hashed ' + res.j.hashed + ' / ' + res.j.considered +
            ' (skipped ' + res.j.skipped + ')';
        })
        .catch(function (err) {
          status.textContent = String(err);
        });
    });
  }

  var catalogBtn = document.getElementById('catalog-refresh-btn');
  var catalogSel = document.getElementById('catalog-refresh-platform');
  var catalogStatus = document.getElementById('catalog-refresh-status');
  if (catalogBtn && catalogSel && catalogStatus) {
    catalogBtn.addEventListener('click', function () {
      catalogStatus.textContent = 'Refreshing from IGDB… this can take a minute.';
      catalogBtn.disabled = true;
      fetch('/api/licensed-catalog/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ library_platform: catalogSel.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          catalogBtn.disabled = false;
          if (!res.ok) {
            catalogStatus.textContent = res.j.error || 'Refresh failed';
            return;
          }
          catalogStatus.textContent = 'Cached ' + res.j.unique_titles + ' titles (' +
            res.j.cached_rows + ' region rows, ' + res.j.pages + ' pages).';
        })
        .catch(function (err) {
          catalogBtn.disabled = false;
          catalogStatus.textContent = String(err);
        });
    });
  }
})();
