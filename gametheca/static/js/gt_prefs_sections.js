/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
                  (function () {
                    var KEY = 'gt.prefs.collapsedSections';
                    var panel = document.getElementById('preferencesModal');
                    if (!panel) return;
                    var sections = panel.querySelectorAll('[data-prefs-section]');
                    if (!sections.length) return;

                    var closed;
                    try {
                      closed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
                    } catch (err) {
                      closed = [];
                    }
                    if (!Array.isArray(closed)) closed = [];

                    function save() {
                      var next = [];
                      sections.forEach(function (node) {
                        if (!node.open) next.push(node.dataset.prefsSection);
                      });
                      try {
                        window.localStorage.setItem(KEY, JSON.stringify(next));
                      } catch (err) {
                        /* Preference only — the panel works either way. */
                      }
                    }

                    sections.forEach(function (node) {
                      if (closed.indexOf(node.dataset.prefsSection) !== -1) {
                        node.open = false;
                      }
                      node.addEventListener('toggle', save);
                    });
                  })();
