/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  var el = document.getElementById('od-attract-settings');
  try {
    window.attractModeSettings = el ? JSON.parse(el.textContent) : null;
  } catch (err) {
    console.error('Attract mode settings:', err);
    window.attractModeSettings = null;
  }
})();
