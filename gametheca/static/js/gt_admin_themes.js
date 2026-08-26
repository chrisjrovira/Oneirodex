/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
(function () {
    // The per-account swatch grid that used to live here is retired: choosing a
    // theme is a member preference and now happens in one place, Preferences.
    // Its POST /admin/themes/apply handler and this block went with it.

    // ---- Loading icon lock / rotate ----
    const form = document.getElementById('gtLoadingIconForm');
    if (!form) {
        return;
    }
    const select = document.getElementById('gtLoadingIconId');
    const preview = document.getElementById('gtLoadingIconPreview');
    const loadStatus = document.getElementById('gtLoadingIconStatus');
    const configUrl = form.dataset.configUrl;

    function setLoadStatus(message, isError) {
        if (loadStatus) {
            loadStatus.textContent = message || '';
            loadStatus.classList.toggle('is-error', !!isError);
        }
    }

    function selectedMode() {
        const checked = form.querySelector('input[name="loading_icon_mode"]:checked');
        return checked ? checked.value : 'rotate';
    }

    function syncLockUi() {
        const lock = selectedMode() === 'lock';
        if (select) {
            select.disabled = !lock;
            select.required = lock;
        }
        refreshPreview();
    }

    function refreshPreview() {
        if (!preview || !window.GtLoadingMotifs) {
            return;
        }
        preview.innerHTML = '';
        const mode = selectedMode();
        const id = mode === 'lock' ? select.value : null;
        if (mode === 'lock' && id) {
            preview.appendChild(window.GtLoadingMotifs.buildNode(id, 'gt-loading-motif--lg'));
        } else if (window.GtLoadingMotifs.CATALOGUE) {
            // Held still and animated on hover (W27-E2) — a dozen motifs all
            // looping at once reads as a busy page rather than a chooser.
            window.GtLoadingMotifs.CATALOGUE.forEach(function (motifId) {
                var node = window.GtLoadingMotifs.buildNode(
                    motifId, 'gt-loading-motif--sm gt-loading-motif--preview');
                node.setAttribute('tabindex', '0');
                node.setAttribute('title', motifId);
                preview.appendChild(node);
            });
            // Say how many are actually in rotation. These six are the base
            // hardware archetypes — the only ids this classic page can draw,
            // since its markup table is generated from the SPA's base set — but
            // rotate draws from the whole catalogue, which is far larger. A row
            // of six with no caption implied six was all there was.
            if (window.gtLoadingCatalogueSize > 6) {
                var note = document.createElement('p');
                note.className = 'gt-themes-loading__note';
                note.textContent =
                    'Rotating across ' + window.gtLoadingCatalogueSize
                    + ' motifs — one per system, plus these six generic ones.';
                preview.appendChild(note);
            }
        }
    }

    form.querySelectorAll('input[name="loading_icon_mode"]').forEach(function (input) {
        input.addEventListener('change', syncLockUi);
    });
    if (select) {
        select.addEventListener('change', refreshPreview);
    }

    fetch(configUrl, {
        credentials: 'same-origin',
        headers: CSRFUtils.getHeaders({ Accept: 'application/json' }),
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Could not load loading-icon settings');
        return res.json();
    })
    .then(function (data) {
        const catalogue = data.catalogue || [];
        // Published for refreshPreview, which runs before this fetch resolves
        // and cannot see the response otherwise (W27-E2).
        window.gtLoadingCatalogueSize = catalogue.length;
        if (select) {
            select.innerHTML = '';
            // Grouped by family (GT-B24). The catalogue is 78 entries now —
            // six generic archetypes plus one per supported system — and a flat
            // list that long is not something anyone can choose from. optgroup
            // keeps it a plain <select>, so keyboard and screen-reader
            // behaviour stay native.
            const groups = new Map();
            catalogue.forEach(function (row) {
                const family = row.family || 'Other';
                if (!groups.has(family)) groups.set(family, []);
                groups.get(family).push(row);
            });
            // 'Classic' first — those are the non-system archetypes and the
            // safe default; every vendor family after it, alphabetically.
            const families = Array.from(groups.keys()).sort(function (a, b) {
                if (a === 'Classic') return -1;
                if (b === 'Classic') return 1;
                return a.localeCompare(b);
            });
            families.forEach(function (family) {
                const group = document.createElement('optgroup');
                group.label = family;
                groups.get(family).forEach(function (row) {
                    const opt = document.createElement('option');
                    opt.value = row.id;
                    opt.textContent = row.name || row.id;
                    if (row.description) opt.title = row.description;
                    group.appendChild(opt);
                });
                select.appendChild(group);
            });
            if (data.loading_icon_id || data.stored_id) {
                select.value = data.loading_icon_id || data.stored_id;
            } else if (catalogue[0]) {
                select.value = catalogue[0].id;
            }
        }
        const mode = data.stored_mode || data.loading_icon_mode || 'rotate';
        const radio = form.querySelector('input[name="loading_icon_mode"][value="' + mode + '"]');
        if (radio) radio.checked = true;
        syncLockUi();
    })
    .catch(function (err) {
        setLoadStatus(err.message || 'Failed to load settings', true);
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        const mode = selectedMode();
        const payload = { loading_icon_mode: mode };
        if (mode === 'lock') {
            payload.loading_icon_id = select.value;
        }
        setLoadStatus('Saving\u2026', false);
        fetch(configUrl, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: CSRFUtils.getHeaders({
                'Content-Type': 'application/json',
                Accept: 'application/json',
            }),
            body: JSON.stringify(payload),
        })
        .then(function (res) {
            return res.json().then(function (data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function (result) {
            if (!result.ok) {
                throw new Error(result.data.error || 'Save failed');
            }
            if (window.GtLoadingMotifs) {
                window.GtLoadingMotifs.clearCache();
            }
            setLoadStatus('Saved.', false);
            syncLockUi();
        })
        .catch(function (err) {
            setLoadStatus(err.message || 'Save failed', true);
        });
    });
})();
