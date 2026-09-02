/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  ['deleteWarningModal', 'batchEditModal'].forEach(function (id) {
    var modalEl = document.getElementById(id);
    if (!modalEl) return;
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
  });
})();
