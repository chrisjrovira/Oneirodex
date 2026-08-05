document.addEventListener('DOMContentLoaded', function() {
    const sectionsList = document.getElementById('discovery-sections-list');

    // Initialize Sortable.js
    new Sortable(sectionsList, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: function(evt) {
            updateSectionOrder();
        }
    });

    // Handle visibility toggles
    document.querySelectorAll('.section-visibility-toggle').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const sectionId = this.dataset.sectionId;
            updateSectionVisibility(sectionId, this.checked);
        });
    });

    // Update section order in database
    function updateSectionOrder() {
        const sections = document.querySelectorAll('.section-item');
        const orderData = Array.from(sections).map((section, index) => ({
            id: section.dataset.sectionId,
            order: index
        }));

        fetch('/admin/api/discovery_sections/order', {
            method: 'POST',
            headers: CSRFUtils.getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ sections: orderData })
        })
        .then(response => response.json())
        .then(handleResponse)
        .catch(error => {
            console.error('Error:', error);
            $.notify("Error updating section order", "error");
        });
    }

    function handleResponse(data) {
        if (data.success) {
            $.notify("Section order updated successfully", "success");
        } else {
            $.notify("Failed to update section order: " + (data.error || "Unknown error"), "error");
        }
    }

    // Update section visibility in database
    function updateSectionVisibility(sectionId, isVisible) {
        fetch('/admin/api/discovery_sections/visibility', {
            method: 'POST',
            headers: CSRFUtils.getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
                section_id: sectionId,
                is_visible: isVisible
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $.notify("Section visibility updated successfully", "success");
            } else {
                $.notify("Failed to update section visibility", "error");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            $.notify("Error updating section visibility", "error");
        });
    }

    // ---- Custom zone create / edit / delete ----

    const zoneModalEl = document.getElementById('zoneModal');
    if (!zoneModalEl) return;
    if (window.gtHoistBootstrapModals) {
        window.gtHoistBootstrapModals(zoneModalEl);
    } else if (zoneModalEl.parentElement !== document.body) {
        document.body.appendChild(zoneModalEl);
    }
    const zoneModal = bootstrap.Modal.getOrCreateInstance(zoneModalEl);

    const zoneIdInput = document.getElementById('zoneId');
    const zoneNameInput = document.getElementById('zoneName');
    const zoneModalTitle = document.getElementById('zoneModalTitle');
    const zoneManualFields = document.getElementById('zoneManualFields');
    const zoneFilterFields = document.getElementById('zoneFilterFields');
    const zoneGameUuidsInput = document.getElementById('zoneGameUuids');
    const zoneFilterTypeSelect = document.getElementById('zoneFilterType');
    const zoneFilterValueSelects = {
        library: document.getElementById('zoneFilterValueLibrary'),
        platform: document.getElementById('zoneFilterValuePlatform'),
        genre: document.getElementById('zoneFilterValueGenre'),
    };
    const zoneModalError = document.getElementById('zoneModalError');
    const zoneSaveBtn = document.getElementById('zoneSaveBtn');
    const addZoneBtn = document.getElementById('add-zone-btn');

    function setZoneMode(mode) {
        const manualRadio = document.getElementById('zoneModeManual');
        const filterRadio = document.getElementById('zoneModeFilter');
        if (mode === 'filter') {
            filterRadio.checked = true;
            zoneManualFields.classList.add('d-none');
            zoneFilterFields.classList.remove('d-none');
        } else {
            manualRadio.checked = true;
            zoneManualFields.classList.remove('d-none');
            zoneFilterFields.classList.add('d-none');
        }
    }

    function setFilterType(type) {
        zoneFilterTypeSelect.value = type;
        Object.keys(zoneFilterValueSelects).forEach((key) => {
            zoneFilterValueSelects[key].classList.toggle('d-none', key !== type);
        });
    }

    // --- UX-C10: pick games by name instead of pasting UUIDs ----------------
    const zoneGameSearch = document.getElementById('zoneGameSearch');
    const zoneGameSearchBtn = document.getElementById('zoneGameSearchBtn');
    const zoneGameHits = document.getElementById('zoneGameHits');
    const zonePicked = document.getElementById('zonePicked');
    const zonePickedCount = document.getElementById('zonePickedCount');
    const ZONE_MAX_GAMES = 60;

    // uuid -> display name. The textarea stays the source of truth on submit,
    // so the advanced paste path keeps working unchanged.
    let picked = [];

    function syncPickedToTextarea() {
        zoneGameUuidsInput.value = picked.map((p) => p.uuid).join('\n');
        if (zonePickedCount) zonePickedCount.textContent = `(${picked.length})`;
    }

    function renderPicked() {
        if (!zonePicked) return;
        zonePicked.innerHTML = '';
        if (!picked.length) {
            const empty = document.createElement('li');
            empty.className = 'list-group-item text-muted small';
            empty.textContent = 'No games yet — search above to add some.';
            zonePicked.appendChild(empty);
        }
        picked.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center gap-2';

            const order = document.createElement('span');
            order.className = 'text-muted small';
            order.textContent = String(index + 1);

            const name = document.createElement('span');
            name.className = 'flex-grow-1';
            // textContent — titles come from scraped store metadata.
            name.textContent = entry.name || entry.uuid;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn btn-sm btn-outline-danger';
            remove.textContent = 'Remove';
            remove.addEventListener('click', () => {
                picked = picked.filter((p) => p.uuid !== entry.uuid);
                renderPicked();
                syncPickedToTextarea();
            });

            li.appendChild(order);
            li.appendChild(name);
            li.appendChild(remove);
            zonePicked.appendChild(li);
        });
        syncPickedToTextarea();
    }

    function addPicked(uuid, name) {
        if (!uuid) return;
        if (picked.some((p) => p.uuid === uuid)) return;
        if (picked.length >= ZONE_MAX_GAMES) {
            zoneModalError.textContent = `A zone holds at most ${ZONE_MAX_GAMES} games.`;
            zoneModalError.classList.remove('d-none');
            return;
        }
        picked.push({ uuid, name });
        renderPicked();
    }

    async function searchZoneGames() {
        const q = (zoneGameSearch && zoneGameSearch.value || '').trim();
        if (!q) return;
        try {
            const resp = await fetch(`/api/search?query=${encodeURIComponent(q)}`, {
                credentials: 'same-origin',
            });
            const rows = await resp.json();
            zoneGameHits.innerHTML = '';
            const hits = Array.isArray(rows) ? rows.slice(0, 12) : [];
            if (!hits.length) {
                const none = document.createElement('div');
                none.className = 'list-group-item text-muted small';
                none.textContent = `No library games match “${q}”.`;
                zoneGameHits.appendChild(none);
            }
            hits.forEach((hit) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'list-group-item list-group-item-action';
                btn.textContent = hit.name || hit.uuid;
                btn.addEventListener('click', () => {
                    addPicked(hit.uuid, hit.name);
                    zoneGameHits.classList.add('d-none');
                    zoneGameSearch.value = '';
                });
                zoneGameHits.appendChild(btn);
            });
            zoneGameHits.classList.remove('d-none');
        } catch (err) {
            zoneModalError.textContent = 'Could not search the library.';
            zoneModalError.classList.remove('d-none');
        }
    }

    if (zoneGameSearchBtn) zoneGameSearchBtn.addEventListener('click', () => void searchZoneGames());
    if (zoneGameSearch) {
        zoneGameSearch.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void searchZoneGames();
            }
        });
    }
    // Hand-edited UUIDs win — the textarea remains the submitted value.
    if (zoneGameUuidsInput) {
        zoneGameUuidsInput.addEventListener('input', () => {
            picked = zoneGameUuidsInput.value
                .split(/[\s,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((uuid) => {
                    const known = picked.find((p) => p.uuid === uuid);
                    return { uuid, name: known ? known.name : uuid };
                });
            renderPicked();
        });
    }

    function resetZoneModal() {
        zoneModalError.classList.add('d-none');
        zoneModalError.textContent = '';
        zoneIdInput.value = '';
        zoneNameInput.value = '';
        zoneGameUuidsInput.value = '';
        picked = [];
        renderPicked();
        if (zoneGameHits) zoneGameHits.classList.add('d-none');
        setZoneMode('manual');
        setFilterType('library');
    }

    document.querySelectorAll('input[name="zoneMode"]').forEach((radio) => {
        radio.addEventListener('change', function() {
            setZoneMode(this.value);
        });
    });

    zoneFilterTypeSelect.addEventListener('change', function() {
        setFilterType(this.value);
    });

    addZoneBtn.addEventListener('click', function() {
        resetZoneModal();
        zoneModalTitle.textContent = 'Add Discovery Zone';
        zoneModal.show();
    });

    document.querySelectorAll('.zone-edit-btn').forEach((btn) => {
        btn.addEventListener('click', function() {
            const item = this.closest('.section-item');
            const config = JSON.parse(item.dataset.sectionConfig || '{}');
            resetZoneModal();
            zoneIdInput.value = item.dataset.sectionId;
            zoneNameInput.value = item.dataset.sectionName || '';
            zoneModalTitle.textContent = 'Edit Discovery Zone';

            if (config.mode === 'filter') {
                setZoneMode('filter');
                setFilterType(config.filter_type || 'library');
                const select = zoneFilterValueSelects[config.filter_type];
                if (select) select.value = config.filter_value || '';
            } else {
                setZoneMode('manual');
                zoneGameUuidsInput.value = (config.game_uuids || []).join('\n');
                // Existing zones open with their games listed, not as raw ids.
                picked = (config.game_uuids || []).map((uuid) => ({ uuid, name: uuid }));
                renderPicked();
            }

            zoneModal.show();
        });
    });

    document.querySelectorAll('.zone-delete-btn').forEach((btn) => {
        btn.addEventListener('click', function() {
            const sectionId = this.dataset.sectionId;
            const item = this.closest('.section-item');
            const name = item ? item.dataset.sectionName : 'this zone';
            if (!confirm(`Delete discovery zone "${name}"? This cannot be undone.`)) return;

            fetch(`/admin/api/discovery_sections/${sectionId}`, {
                method: 'DELETE',
                headers: CSRFUtils.getHeaders({ 'Content-Type': 'application/json' }),
            })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    $.notify('Zone deleted', 'success');
                    if (item) item.remove();
                } else {
                    $.notify('Failed to delete zone: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                $.notify('Error deleting zone', 'error');
            });
        });
    });

    zoneSaveBtn.addEventListener('click', function() {
        const id = zoneIdInput.value;
        const name = zoneNameInput.value.trim();
        const mode = document.querySelector('input[name="zoneMode"]:checked').value;

        const payload = { name, mode };
        if (mode === 'manual') {
            payload.game_uuids = zoneGameUuidsInput.value;
        } else {
            const filterType = zoneFilterTypeSelect.value;
            payload.filter_type = filterType;
            payload.filter_value = zoneFilterValueSelects[filterType].value;
        }

        const url = id ? `/admin/api/discovery_sections/${id}` : '/admin/api/discovery_sections';
        const method = id ? 'PUT' : 'POST';

        zoneModalError.classList.add('d-none');

        fetch(url, {
            method: method,
            headers: CSRFUtils.getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (!ok || !data.success) {
                zoneModalError.textContent = data.error || 'Failed to save zone';
                zoneModalError.classList.remove('d-none');
                return;
            }
            zoneModal.hide();
            $.notify(id ? 'Zone updated' : 'Zone created', 'success');
            location.reload();
        })
        .catch((error) => {
            console.error('Error:', error);
            zoneModalError.textContent = 'Unexpected error saving zone';
            zoneModalError.classList.remove('d-none');
        });
    });
});
