document.addEventListener('DOMContentLoaded', function () {
    const DIR_PREFIX = 'dir:';
    const form = document.getElementById('gtScanFilterForm');
    const modalEl = document.getElementById('addFilterModal');
    const saveBtn = document.getElementById('saveFilter');
    if (!form || !modalEl) return;

    const addFilterModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const rawInput = document.getElementById('filter_pattern_raw');
    const hiddenInput = document.getElementById('filter_pattern');
    const dirPrefixEl = document.getElementById('gtFilterDirPrefix');
    const labelEl = document.getElementById('gtFilterPatternLabel');
    const hintEl = document.getElementById('gtFilterPatternHint');
    const caseRow = document.getElementById('gtFilterCaseRow');
    const caseSelect = document.getElementById('case_sensitive');

    const COPY = {
        name: {
            label: 'Tag to strip',
            placeholder: 'e.g. GOG',
            hint: 'Stored as the tag only. Scan strips -tag and .tag from folder names.',
        },
        dir: {
            label: 'Folder glob',
            placeholder: 'e.g. OpenVR* or _MyTools',
            hint: 'Saved as dir:… Skip matching folder basenames (case-insensitive fnmatch). Prefer prefix globs.',
        },
    };

    function selectedKind() {
        const checked = form.querySelector('input[name="gt_filter_kind"]:checked');
        return checked && checked.value === 'dir' ? 'dir' : 'name';
    }

    function stripDirPrefix(value) {
        const text = String(value || '').trim();
        if (text.toLowerCase().indexOf(DIR_PREFIX) === 0) {
            return text.slice(DIR_PREFIX.length).trim();
        }
        return text;
    }

    function syncHiddenFromRaw() {
        if (!rawInput || !hiddenInput) return;
        const kind = selectedKind();
        const body = String(rawInput.value || '').trim();
        if (!body) {
            hiddenInput.value = '';
            return;
        }
        if (kind === 'dir') {
            const glob = stripDirPrefix(body);
            hiddenInput.value = glob ? (DIR_PREFIX + glob) : '';
        } else {
            hiddenInput.value = stripDirPrefix(body);
        }
    }

    function applyKindUi() {
        const kind = selectedKind();
        const copy = COPY[kind] || COPY.name;
        if (labelEl) labelEl.textContent = copy.label;
        if (rawInput) rawInput.placeholder = copy.placeholder;
        if (hintEl) hintEl.textContent = copy.hint;
        if (dirPrefixEl) {
            const show = kind === 'dir';
            dirPrefixEl.hidden = !show;
            dirPrefixEl.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        if (caseRow) caseRow.hidden = kind === 'dir';
        if (kind === 'dir' && caseSelect) caseSelect.value = 'no';
        if (rawInput) rawInput.value = stripDirPrefix(rawInput.value);
        syncHiddenFromRaw();
    }

    function fillFilterForm(kind, pattern, caseSensitive) {
        const kindRadio = form.querySelector(
            'input[name="gt_filter_kind"][value="' + (kind === 'dir' ? 'dir' : 'name') + '"]'
        );
        if (kindRadio) kindRadio.checked = true;
        if (rawInput) rawInput.value = stripDirPrefix(pattern || '');
        if (caseSelect) caseSelect.value = caseSensitive === 'yes' ? 'yes' : 'no';
        applyKindUi();
    }

    form.querySelectorAll('input[name="gt_filter_kind"]').forEach(function (radio) {
        radio.addEventListener('change', applyKindUi);
    });
    if (rawInput) {
        rawInput.addEventListener('input', syncHiddenFromRaw);
        rawInput.addEventListener('change', syncHiddenFromRaw);
    }

    document.querySelectorAll('.gt-scan-filters__chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            fillFilterForm(
                chip.getAttribute('data-gt-filter-kind'),
                chip.getAttribute('data-gt-filter-pattern'),
                chip.getAttribute('data-gt-filter-case') || 'no'
            );
            addFilterModal.show();
            if (rawInput) {
                rawInput.focus();
                rawInput.select();
            }
        });
    });

    document.querySelectorAll('.admin_manage_filters-remove-btn').forEach(function (button) {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Are you sure you want to remove this filter? This action cannot be undone.')) {
                window.location.href = this.getAttribute('href');
            }
        });
    });

    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            syncHiddenFromRaw();
            if (!hiddenInput || !String(hiddenInput.value || '').trim()) {
                alert('Enter a filter pattern first.');
                if (rawInput) rawInput.focus();
                return;
            }
            const formData = new FormData(form);
            fetch(window.location.pathname, {
                method: 'POST',
                headers: CSRFUtils.getHeaders({
                    'Content-Type': 'application/x-www-form-urlencoded',
                }),
                body: new URLSearchParams(formData),
            })
                .then(function (response) {
                    if (response.ok) {
                        addFilterModal.hide();
                        window.location.reload();
                    } else {
                        throw new Error('Failed to add filter');
                    }
                })
                .catch(function (error) {
                    console.error('Error:', error);
                    alert('Failed to add filter. Please try again.');
                });
        });
    }

    modalEl.addEventListener('shown.bs.modal', function () {
        applyKindUi();
        if (rawInput && !rawInput.value) rawInput.focus();
    });
    modalEl.addEventListener('hidden.bs.modal', function () {
        fillFilterForm('name', '', 'no');
    });

    applyKindUi();
});
