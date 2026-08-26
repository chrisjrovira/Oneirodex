/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  try {
    var raw = document.getElementById('gt-server-status-data');
    if (raw && typeof initializeServerData === 'function') {
      initializeServerData(JSON.parse(raw.textContent));
    }
  } catch (err) {
    console.error('Server status data:', err);
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.bootstrap && bootstrap.Tooltip) {
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
        new bootstrap.Tooltip(el);
      });
    }
    document.querySelectorAll('time.gt-locale-time[datetime]').forEach(function (el) {
      var d = new Date(el.getAttribute('datetime'));
      if (!isNaN(d.getTime())) {
        el.textContent = d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
      }
    });
    if (typeof initializeServerStatus === 'function') {
      initializeServerStatus();
    }
  });
})();
