/**
 * Sortable classic tables (UX-C8 · W27-C1 · W27-C2).
 *
 * `DataTable.jsx` gave the React admin one sortable table. The classic Jinja
 * pages could not use it, so sorting arrived per page or not at all: the
 * unmatched table grew a bespoke sorter during UID-005, and the active scan
 * jobs table next to it never got one — which is what W27-C2 reports.
 *
 * This is the classic-side counterpart. Adoption is two attributes:
 *
 *     <table data-gt-sortable>
 *       <thead><tr><th data-sort-key="id">ID</th> …
 *
 * A `<th>` without `data-sort-key` stays inert, which is what the checkbox and
 * Actions columns want. The header button is built here rather than written
 * into each template, because per-page markup is precisely how this behaviour
 * drifted in the first place.
 *
 * Sort order deliberately matches `DataTable.jsx` rule for rule — three-state
 * toggle, numeric-aware compare, and absent values last in *both* directions,
 * since "missing" is not "smallest". Two stacks that sort the same column
 * differently is the inconsistency W27-C1 is about.
 *
 * Value for a cell, in order of preference:
 *   1. `data-sort-<key>` on the `<tr>`   — the convention the unmatched table
 *      already established, so it can adopt this module without re-tagging
 *   2. `data-sort-value` on the `<td>`
 *   3. the cell's text
 *
 * Rows spanning the full width (`<td colspan>`) are treated as furniture — the
 * "no scan jobs yet" row must not be shuffled in among real ones.
 */
(function (global) {
    'use strict';

    var SEQ_ATTR = 'data-gt-seq';

    function isFurnitureRow(row) {
        // An empty-state or message row: one cell spanning the table. Sorting
        // it against real rows would be meaningless, and dropping it would
        // lose the message.
        var cells = row.querySelectorAll('td');
        if (cells.length === 0) return true;
        for (var i = 0; i < cells.length; i++) {
            var span = parseInt(cells[i].getAttribute('colspan') || '1', 10);
            if (span > 1) return true;
        }
        return false;
    }

    function cellText(row, index) {
        var cells = row.children;
        if (index >= cells.length) return '';
        var cell = cells[index];
        var explicit = cell.getAttribute && cell.getAttribute('data-sort-value');
        if (explicit !== null && explicit !== undefined) return explicit;
        return (cell.textContent || '').trim();
    }

    function sortValue(row, key, index) {
        var onRow = row.getAttribute('data-sort-' + key);
        if (onRow !== null && onRow !== undefined) return onRow;
        return cellText(row, index);
    }

    /** Mirrors DataTable.jsx compare(). Keep the two in step. */
    function compare(av, bv, factor) {
        var aEmpty = av === null || av === undefined || av === '';
        var bEmpty = bv === null || bv === undefined || bv === '';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        var an = Number(av);
        var bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * factor;

        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    }

    function enhance(table) {
        if (!table || table.__gtSortable) return null;

        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');
        if (!thead || !tbody) return null;

        var headers = [];
        var allTh = thead.querySelectorAll('th');
        for (var i = 0; i < allTh.length; i++) {
            var th = allTh[i];
            var key = th.getAttribute('data-sort-key');
            if (key) headers.push({ th: th, key: key, index: i });
        }
        if (headers.length === 0) return null;

        var state = null;   // { key, dir }
        var observer = null;
        var seq = 0;

        function stampNewRows() {
            var rows = tbody.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                if (!rows[i].hasAttribute(SEQ_ATTR)) {
                    rows[i].setAttribute(SEQ_ATTR, String(seq++));
                }
            }
        }

        function apply() {
            stampNewRows();

            var all = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
            var sortable = [];
            var furniture = [];
            for (var i = 0; i < all.length; i++) {
                (isFurnitureRow(all[i]) ? furniture : sortable).push(all[i]);
            }
            if (sortable.length === 0) {
                updateIndicators();
                return;
            }

            var header = null;
            if (state) {
                for (var h = 0; h < headers.length; h++) {
                    if (headers[h].key === state.key) header = headers[h];
                }
            }

            if (!header) {
                // Cleared. Fall back to arrival order rather than leaving the
                // last sort frozen in the DOM — on a polled table the arrival
                // order is the server's own ranking, which is a real answer.
                sortable.sort(function (a, b) {
                    return Number(a.getAttribute(SEQ_ATTR)) - Number(b.getAttribute(SEQ_ATTR));
                });
            } else {
                var factor = state.dir === 'desc' ? -1 : 1;
                sortable.sort(function (a, b) {
                    return compare(
                        sortValue(a, header.key, header.index),
                        sortValue(b, header.key, header.index),
                        factor,
                    );
                });
            }

            // Suspend the observer rather than flagging "this move was ours".
            // MutationObserver delivers asynchronously, so a flag set and
            // cleared around these appends is already false by the time our own
            // records arrive — and re-sorting on them appends again, which
            // records again. That is an endless loop, not a stray extra pass.
            // disconnect() also empties the pending queue, which is the half a
            // boolean cannot do.
            if (observer) observer.disconnect();
            try {
                for (var r = 0; r < sortable.length; r++) tbody.appendChild(sortable[r]);
                // Furniture last: an empty-state row belongs under the data,
                // not shuffled through it.
                for (var f = 0; f < furniture.length; f++) tbody.appendChild(furniture[f]);
            } finally {
                if (observer) observer.observe(tbody, { childList: true });
            }

            updateIndicators();
        }

        function updateIndicators() {
            for (var i = 0; i < headers.length; i++) {
                var entry = headers[i];
                var active = !!state && state.key === entry.key;
                var button = entry.th.querySelector('.gt-sort-btn');
                var mark = entry.th.querySelector('.gt-sort-btn__ind');

                entry.th.setAttribute(
                    'aria-sort',
                    !active ? 'none' : state.dir === 'asc' ? 'ascending' : 'descending',
                );
                if (button) {
                    if (active) button.classList.add('is-active');
                    else button.classList.remove('is-active');
                }
                if (mark) {
                    mark.textContent = !active ? '↕' : state.dir === 'asc' ? '▲' : '▼';
                }
            }
        }

        function toggle(key) {
            if (!state || state.key !== key) state = { key: key, dir: 'asc' };
            else if (state.dir === 'asc') state = { key: key, dir: 'desc' };
            else state = null; // third click clears, same as DataTable
            apply();
        }

        // Build the header controls, moving the existing label inside so the
        // template keeps owning the wording.
        headers.forEach(function (entry) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'gt-sort-btn';

            // Move the existing nodes rather than copying textContent: header
            // cells here routinely hold an `icons.icon()` macro's markup, and
            // flattening to text would delete it without any visible error.
            var text = document.createElement('span');
            text.className = 'gt-sort-btn__label';
            while (entry.th.firstChild) {
                text.appendChild(entry.th.firstChild);
            }

            var mark = document.createElement('span');
            mark.className = 'gt-sort-btn__ind';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = '↕';

            button.appendChild(text);
            button.appendChild(mark);

            entry.th.appendChild(button);
            if (!entry.th.getAttribute('scope')) entry.th.setAttribute('scope', 'col');
            entry.th.setAttribute('aria-sort', 'none');

            button.addEventListener('click', function () {
                toggle(entry.key);
            });
        });

        stampNewRows();

        // The scan jobs table is repopulated by a poller that clears tbody and
        // re-appends. Without this the sort would silently revert a few seconds
        // after every click, which reads as the feature being broken rather
        // than absent — worse than not shipping it.
        if (typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(function () {
                stampNewRows();
                if (state) apply();
            });
            observer.observe(tbody, { childList: true });
        }

        var api = {
            table: table,
            sort: function (key, dir) {
                state = key ? { key: key, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
                apply();
            },
            clear: function () {
                state = null;
                apply();
            },
            getState: function () {
                return state ? { key: state.key, dir: state.dir } : null;
            },
            refresh: apply,
        };
        table.__gtSortable = api;
        return api;
    }

    function enhanceAll(root) {
        var scope = root || document;
        var tables = scope.querySelectorAll('table[data-gt-sortable]');
        var made = [];
        for (var i = 0; i < tables.length; i++) {
            var api = enhance(tables[i]);
            if (api) made.push(api);
        }
        return made;
    }

    global.GtSortableTable = { enhance: enhance, enhanceAll: enhanceAll };

    /**
     * Wired here rather than in each template, for the same reason the loading
     * motifs are: a page that has to remember to call this is a page that will
     * eventually forget, and the symptom (a table that just does not sort) is
     * indistinguishable from the feature never having been built.
     */
    function autoEnhance() {
        try {
            enhanceAll(document);
        } catch (e) {
            // Decoration must never take a page down with it.
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoEnhance);
        } else {
            // Script loaded late (deferred, or injected) — the event already fired.
            autoEnhance();
        }
    }
})(typeof window !== 'undefined' ? window : this);
