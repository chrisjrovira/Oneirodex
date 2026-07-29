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
    const zoneModal = new bootstrap.Modal(zoneModalEl);

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

    function resetZoneModal() {
        zoneModalError.classList.add('d-none');
        zoneModalError.textContent = '';
        zoneIdInput.value = '';
        zoneNameInput.value = '';
        zoneGameUuidsInput.value = '';
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
