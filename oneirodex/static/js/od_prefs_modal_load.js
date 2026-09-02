/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  var prefsToggle = document.querySelector('[data-bs-toggle="modal"][data-bs-target="#preferencesModal"]');
  if (!prefsToggle) return;
  var urlEl = document.getElementById('od-prefs-panel-url');
  var panelUrl = urlEl ? JSON.parse(urlEl.textContent) : '/settings/panel';
  prefsToggle.addEventListener('click', function (e) {
    e.preventDefault();
    fetch(panelUrl)
      .then(function (response) { return response.text(); })
      .then(function (html) {
        document.getElementById('preferencesModalContainer').innerHTML = html;
        var prefsModal = document.getElementById('preferencesModal');
        if (window.odHoistBootstrapModals) {
          window.odHoistBootstrapModals(prefsModal);
        }
        new bootstrap.Modal(prefsModal).show();
      })
      .catch(function (error) {
        console.error('Error:', error);
        if (window.$ && $.notify) {
          $.notify('Error loading preferences', 'error');
        }
      });
  });
})();
