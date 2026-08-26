/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
                              (function () {
                                var input = document.getElementById('tileSizeSelect');
                                var label = document.getElementById('tileSizeValue');
                                if (!input || !label) return;
                                var sync = function () { label.textContent = input.value + '%'; };
                                input.addEventListener('input', sync);
                                sync();
                              })();
