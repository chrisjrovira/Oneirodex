/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
  const select = document.getElementById('od-download-version');
  const form = document.getElementById('od-download-form');
  if (!select || !form) return;
  select.addEventListener('change', function () {
    const option = select.options[select.selectedIndex];
    const href = option && option.getAttribute('data-href');
    if (href) form.action = href;
  });
})();
