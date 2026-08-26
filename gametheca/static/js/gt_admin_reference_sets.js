/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  var btn = document.getElementById('rehash-btn');
  var sel = document.getElementById('rehash-platform');
  var status = document.getElementById('rehash-status');
  if (!btn || !sel) return;
  btn.addEventListener('click', function () {
    status.textContent = 'Hashing…';
    var headers = { 'Content-Type': 'application/json' };
    if (window.CSRFUtils && window.CSRFUtils.getHeaders) {
      headers = window.CSRFUtils.getHeaders(headers);
    } else {
      var meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.content) headers['X-CSRFToken'] = meta.content;
    }
    fetch('/api/reference-sets/rehash', {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
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
})();
