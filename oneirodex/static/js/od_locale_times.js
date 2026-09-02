/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
document.querySelectorAll('time.od-locale-time[datetime]').forEach(function (el) {
    var d = new Date(el.getAttribute('datetime'));
    if (!isNaN(d.getTime())) {
        el.textContent = d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
    }
});
