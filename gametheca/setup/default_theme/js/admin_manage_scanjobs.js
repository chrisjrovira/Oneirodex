import { fileIcons as importedFileIcons } from './config/file_type_icons.js';

const fileIcons = importedFileIcons || { default: 'fa-file' };

var currentPathAuto = '';
var currentPathManual = '';

function showSpinner() {
    var el = document.getElementById('globalSpinner');
    if (!el) return;
    el.style.display = 'flex';
    if (window.GtLoadingMotifs) {
        window.GtLoadingMotifs.mount(el, { size: 'lg' });
    }
}

function hideSpinner() {
    var el = document.getElementById('globalSpinner');
    if (el) el.style.display = 'none';
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Machine codes from duplicate_check / scan → one-line librarian copy. */
const UNMATCHED_MATCH_REASON_LABELS = {
    same_path: 'Same on-disk path as an existing library game.',
    title_vs_folder: 'Folder title closely matches an existing library game folder.',
    title_vs_library_name: 'Folder title closely matches an existing library game name.',
    title_below_threshold:
        'IGDB hit exists, but the folder title differs too much to auto-mark as duplicate.',
};

const UNMATCHED_STATUS_FALLBACK = {
    Duplicate:
        'Another library game already uses this IGDB match and the folder title looks like the same game.',
    Unmatched:
        'Could not auto-match to IGDB (or IGDB already used by a different-titled folder).',
    Ignore: 'Folder is ignored and will not be scanned.',
    Pending: 'Awaiting classification.',
};

/**
 * One-line “why unmatched?” explainer. Prefers Backend why_unmatched /
 * unmatched_reason; else match_reason + suggested_kind*. Null-safe.
 */
function formatWhyUnmatched(folder) {
    if (!folder || typeof folder !== 'object') return '';

    const summary =
        (folder.why_unmatched != null && String(folder.why_unmatched).trim()) ||
        (folder.unmatched_reason != null && String(folder.unmatched_reason).trim()) ||
        '';
    if (summary) return summary;

    const rawReason = folder.match_reason == null ? '' : String(folder.match_reason).trim();
    let reason = '';
    if (rawReason) {
        const code = rawReason.toLowerCase();
        reason = UNMATCHED_MATCH_REASON_LABELS[code] || rawReason;
    }

    const suggestedRaw = folder.suggested_kind == null
        ? ''
        : String(folder.suggested_kind).trim().toLowerCase();
    const suggestedKind = ['experience', 'emulator', 'tool', 'game'].includes(suggestedRaw)
        ? suggestedRaw
        : '';
    const suggestedLabel =
        (folder.suggested_kind_label != null && String(folder.suggested_kind_label).trim()) ||
        (suggestedKind === 'experience'
            ? 'Experience'
            : suggestedKind === 'emulator'
                ? 'Emulator'
                : suggestedKind === 'tool'
                    ? 'Tool'
                    : suggestedKind === 'game'
                        ? 'Game'
                        : '');
    const candidate = folder.suggested_candidate_name == null
        ? ''
        : String(folder.suggested_candidate_name).trim();

    if (suggestedLabel) {
        const hint = candidate
            ? `Scan suggests cataloging as ${suggestedLabel} (e.g. ${candidate}).`
            : `Scan suggests cataloging as ${suggestedLabel}.`;
        if (reason) return `${reason} ${hint}`;
        if (folder.status === 'Unmatched' || folder.status === 'Pending') {
            return `No IGDB game match. ${hint}`;
        }
        return hint;
    }

    if (reason) return reason;
    if (folder.status && UNMATCHED_STATUS_FALLBACK[folder.status]) {
        return UNMATCHED_STATUS_FALLBACK[folder.status];
    }
    return '';
}

/**
 * Format Backend match_score beside Why unmatched?. Null-safe.
 * ≤1 → two decimals; 1–100 → whole/one decimal.
 */
function formatMatchScore(score) {
    if (score == null || score === '') return '';
    const n = Number(score);
    if (!Number.isFinite(n)) return '';
    if (n > 1 && n <= 100) {
        return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
    }
    return (Math.round(n * 100) / 100).toFixed(2);
}

// Lightweight toast, independent from showSuccessNotification so it can be
// used for both success and informational best-effort messages.
function showToast(message, variant) {
    const existing = document.querySelector('.success-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'success-notification';
    if (variant === 'info') {
        notification.style.background = 'color-mix(in srgb, var(--gt-info, var(--btn-info)) 95%, transparent)';
    } else if (variant === 'error' || variant === 'danger') {
        notification.style.background = 'color-mix(in srgb, var(--gt-danger, var(--btn-danger)) 95%, transparent)';
        notification.style.color = 'var(--gt-text, #fff)';
    } else if (variant === 'warning') {
        notification.style.background = 'color-mix(in srgb, var(--gt-warning, #d4a017) 95%, transparent)';
    }
    const glyph = variant === 'info' ? 'ℹ' : (variant === 'error' || variant === 'danger') ? '!' : '✓';
    notification.innerHTML = `${glyph} <span>${escapeHtml(message)}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}

/** Field map expected from Backend scan-start / refresh_all once queue/force ships. */
const SCAN_QUEUE_POLICY = { QUEUE: 'queue', FORCE: 'force' };

function isScanBusyStatus(status) {
    return status === 'Running' || status === 'Stopping';
}

function isScanQueuedStatus(status) {
    const s = String(status || '').toLowerCase();
    return s === 'queued' || s === 'pending';
}

function buildScanQueueRequestFields(policy) {
    const useForce = policy === SCAN_QUEUE_POLICY.FORCE;
    return {
        queue_policy: useForce ? SCAN_QUEUE_POLICY.FORCE : SCAN_QUEUE_POLICY.QUEUE,
        force_parallel: useForce,
    };
}

function isAlreadyRunningReject(httpStatus, body) {
    if (httpStatus === 409) return true;
    const status = String(body && body.status || '').toLowerCase();
    if (status === 'rejected') {
        const msg = `${(body && body.message) || ''} ${(body && body.error) || ''}`.toLowerCase();
        return msg.includes('already') || msg.includes('running') || msg.includes('in progress');
    }
    const err = `${(body && body.error) || (body && body.message) || ''}`.toLowerCase();
    return err.includes('already running') || err.includes('already in progress');
}

function toastForScanStartResponse(body, httpOk) {
    const status = String(body && body.status || '').toLowerCase();
    const message = String((body && (body.message || body.error)) || '').trim();
    if (status === 'queued') {
        const pos = body && body.position != null ? ` (position ${body.position})` : '';
        return {
            text: message || `Scan queued${pos}. It will start when the current job finishes.`,
            variant: 'info',
        };
    }
    if (status === 'started') {
        const risk = String((body && body.risk) || '').trim();
        const base = message || 'Scan started.';
        return { text: risk ? `${base} ${risk}` : base, variant: risk ? 'warning' : 'success' };
    }
    if (status === 'rejected' || !httpOk) {
        return { text: message || (body && body.error) || 'Scan request was rejected.', variant: 'error' };
    }
    if (httpOk && (body && (body.count != null || Array.isArray(body.queued)))) {
        const count = body.count != null ? body.count : body.queued.length;
        return { text: message || `Queued ${count} library refresh job(s).`, variant: 'info' };
    }
    if (httpOk) {
        return { text: message || 'Scan request accepted.', variant: 'success' };
    }
    return { text: message || (body && body.error) || 'Scan request failed.', variant: 'error' };
}

function ensureScanConflictModal() {
    let root = document.getElementById('gtScanConflictModal');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'gtScanConflictModal';
    root.className = 'gt-scan-conflict';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'gtScanConflictTitle');
    root.innerHTML = `
        <div class="gt-scan-conflict__panel" role="document">
            <div class="gt-scan-conflict__toolbar">
                <h2 id="gtScanConflictTitle" class="gt-scan-conflict__title">Scan in progress</h2>
                <button type="button" class="gt-scan-conflict__close" data-scan-conflict="cancel" aria-label="Close">×</button>
            </div>
            <p class="gt-scan-conflict__lede">
                Another scan is already running. Queue this request (recommended) or force a parallel run.
            </p>
            <div class="gt-scan-conflict__choices">
                <button type="button" class="btn btn-primary gt-scan-conflict__choice" data-scan-conflict="queue">
                    Queue this scan
                </button>
                <p class="gt-scan-conflict__hint">Default — starts after the current job finishes (safer for Unraid/NAS load).</p>
                <button type="button" class="btn btn-outline-warning gt-scan-conflict__choice" data-scan-conflict="force">
                    Force run now (parallel)
                </button>
                <p class="gt-scan-conflict__warn" role="note">
                    May spike CPU and disk I/O on Unraid/NAS while two scans share the same storage.
                    Prefer Queue unless you know the host can take the load.
                </p>
            </div>
            <div class="gt-scan-conflict__actions">
                <button type="button" class="btn btn-secondary" data-scan-conflict="cancel">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(root);
    return root;
}

/**
 * @param {(policy: 'queue'|'force') => void} onChoose
 * @param {() => void} [onCancel]
 */
function openScanConflictModal(onChoose, onCancel) {
    const root = ensureScanConflictModal();
    root.hidden = false;
    const queueBtn = root.querySelector('[data-scan-conflict="queue"]');
    if (queueBtn) queueBtn.focus();

    function cleanup() {
        root.hidden = true;
        root.removeEventListener('click', onRootClick);
        document.removeEventListener('keydown', onKey);
        root.querySelectorAll('[data-scan-conflict]').forEach((el) => {
            el.removeEventListener('click', onAction);
        });
    }

    function onAction(event) {
        const action = event.currentTarget.getAttribute('data-scan-conflict');
        if (action === 'cancel') {
            cleanup();
            if (onCancel) onCancel();
            return;
        }
        cleanup();
        onChoose(action === 'force' ? SCAN_QUEUE_POLICY.FORCE : SCAN_QUEUE_POLICY.QUEUE);
    }

    function onRootClick(event) {
        if (event.target === root) {
            cleanup();
            if (onCancel) onCancel();
        }
    }

    function onKey(event) {
        if (event.key === 'Escape') {
            cleanup();
            if (onCancel) onCancel();
        }
    }

    root.querySelectorAll('[data-scan-conflict]').forEach((el) => {
        el.addEventListener('click', onAction);
    });
    root.addEventListener('click', onRootClick);
    document.addEventListener('keydown', onKey);
}

function applyQueueFieldsToForm(form, policy) {
    const fields = buildScanQueueRequestFields(policy);
    ;['queue_policy', 'force_parallel'].forEach((name) => {
        let input = form.querySelector(`input[name="${name}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = name === 'force_parallel' ? (fields.force_parallel ? '1' : '0') : fields.queue_policy;
    });
}

function clearQueueFieldsFromForm(form) {
    form.querySelectorAll('input[name="queue_policy"], input[name="force_parallel"]').forEach((el) => el.remove());
}

async function copyPathToClipboard(path) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(path);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = path;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        return true;
    } catch (error) {
        console.error('Copy to clipboard failed:', error);
        return false;
    }
}

function attachDeleteFolderFormListeners() {
    document.querySelectorAll('.delete-folder-form').forEach(form => {
        if (!form.dataset.listenerAdded) {
            form.addEventListener('submit', function(event) {
                event.preventDefault();
                const folderPath = form.querySelector('[name="folder_path"]').value;
                
                // Add confirmation dialog
                if (!confirm(`Are you sure you want to delete the folder ${folderPath} FROM DISK?`)) {
                    console.log("Deletion cancelled by user");
                    return; // Exit the function if user cancels
                }

                showSpinner();
                const csrfToken = CSRFUtils.getToken();

                console.log("Attempting to delete folder with path:", folderPath);

                fetch('/delete_folder', {
                    method: 'POST',
                    headers: CSRFUtils.getHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({folder_path: folderPath})
                })
                .then(response => response.json())
                .then(data => {
                    console.log("Server response:", data);

                    if(data.status === 'success') {
                        console.log("Deletion successful, removing row.");
                        form.closest('tr').remove();
                    } else {
                        console.log("Deletion not successful:", data.message);
                        if (data.message === "The specified path does not exist or is not a folder. Entry removed if it was in the database.") {
                            console.log("Folder does not exist, removing row.");
                            form.closest('tr').remove();
                        }
                    }
                    alert(data.message);
                })
                .catch(error => {
                    console.error('Fetch error:', error);
                })
                .finally(() => {
                    hideSpinner();
                });
            });
            form.dataset.listenerAdded = 'true';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Document loaded. Setting up form submission handlers and tab activation based on activeTab.");

    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })

    // Simple table references - no DataTables initialization needed
    const scanJobsTableBody = document.getElementById('jobsTableBody');
    const unmatchedTableBody = document.getElementById('unmatchedFoldersTableBody');

    const urlParams = new URLSearchParams(window.location.search);
    const urlActiveTab = urlParams.get('active_tab');
    const metaActiveTab = document.querySelector('meta[name="active-tab"]').getAttribute('content');
    const storedActiveTab = localStorage.getItem('scan_management_active_tab');

    // Priority: URL parameter > localStorage > meta tag > default 'auto'
    const activeTab = urlActiveTab || storedActiveTab || metaActiveTab || 'auto';
    console.log("Active tab determined:", activeTab, {urlActiveTab, storedActiveTab, metaActiveTab});

    switch (activeTab) {
        case 'manual':
            console.log("Activating manualScan tab.");
            new bootstrap.Tab(document.querySelector('#manualScan-tab')).show();
            break;
        case 'unmatched':
            console.log("Activating unmatchedFolders tab.");
            new bootstrap.Tab(document.querySelector('#unmatchedFolders-tab')).show();
            break;
        case 'scan_filters':
            console.log("Activating scanFilters tab.");
            new bootstrap.Tab(document.querySelector('#scanFilters-tab')).show();
            break;
        case 'file_extensions':
            console.log("Activating fileExtensions tab.");
            new bootstrap.Tab(document.querySelector('#fileExtensions-tab')).show();
            break;
        case 'image_queue':
            console.log("Activating imageQueue tab.");
            new bootstrap.Tab(document.querySelector('#imageQueue-tab')).show();
            break;
        case 'deleteLibrary':
            console.log("Activating deleteLibrary tab.");
            new bootstrap.Tab(document.querySelector('#deleteLibrary-tab')).show();
            break;
        default:
            console.log("Defaulting to activating autoScan tab.");
            new bootstrap.Tab(document.querySelector('#autoScan-tab')).show();
    }

    // Add event listeners to all tab links to update URL and localStorage when clicked
    document.querySelectorAll('.admin_manage_scanjobs-nav-tabs .nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(event) {
            const tabId = event.target.getAttribute('href').substring(1); // Remove # from href
            let activeTabValue = 'auto';

            switch(tabId) {
                case 'manualScan':
                    activeTabValue = 'manual';
                    break;
                case 'unmatchedFolders':
                    activeTabValue = 'unmatched';
                    break;
                case 'scanFilters':
                    activeTabValue = 'scan_filters';
                    break;
                case 'fileExtensions':
                    activeTabValue = 'file_extensions';
                    break;
                case 'imageQueue':
                    activeTabValue = 'image_queue';
                    break;
                default:
                    activeTabValue = 'auto';
            }

            // Store in localStorage for persistence
            localStorage.setItem('scan_management_active_tab', activeTabValue);

            // Update URL without page reload
            const url = new URL(window.location.href);
            url.searchParams.set('active_tab', activeTabValue);
            window.history.replaceState({}, '', url.toString());
        });
    });

    // Prevent form submission on pressing Enter in path inputs; trigger Browse instead
    const autoScanForm = document.querySelector('#autoScan form');
    if (autoScanForm) {
        autoScanForm.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && event.target && event.target.tagName === 'INPUT') {
                event.preventDefault();
                const browseFoldersBtn = document.querySelector('#browseFoldersBtn');
                if (browseFoldersBtn) {
                    browseFoldersBtn.click();
                }
            }
        });
    }

    // Same for manual scan form
    const manualScanForm = document.querySelector('#manualScan form');
    if (manualScanForm) {
        manualScanForm.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && event.target && event.target.tagName === 'INPUT') {
                event.preventDefault();
                const browseFoldersBtnManual = document.querySelector('#browseFoldersBtnManual');
                if (browseFoldersBtnManual) {
                    browseFoldersBtnManual.click();
                }
            }
        });
    }

    setupFolderBrowse('#browseFoldersBtn', '#folderContents', '#loadingSpinner', '#upFolderBtn', '#folder_path', 'currentPathAuto');
    setupFolderBrowse('#browseFoldersBtnManual', '#folderContentsManual', '#loadingSpinnerManual', '#upFolderBtnManual', '#manualFolderPath', 'currentPathManual');

    // No complex toggle functionality needed for simplified table

    var csrfToken = CSRFUtils.getToken();

    // Helper function to get user-friendly status display
    function getDisplayStatus(job) {
        if (job.status === 'Failed' && job.error_message) {
            if (job.error_message === 'Scan cancelled by user') {
                return 'Cancelled';
            } else if (job.error_message === 'Scan job interrupted by server restart') {
                return 'Interrupted by server restart';
            }
        }
        return job.status;
    }

    function progressCounts(job) {
        const success = Number(job.folders_success) || 0;
        const failed = Number(job.folders_failed) || 0;
        const total = Number(job.total_folders) || 0;
        const processed = success + failed;
        const percentage = total > 0
            ? (Number(job.progress_percentage) || Math.round((processed / total) * 1000) / 10)
            : 0;
        return { success, failed, total, processed, percentage };
    }

    // Tracks whether any job is Running/Stopping — used by Start Scan conflict modal.
    let scanBusy = false;

    const updateScanJobs = () => {
        fetch('/api/scan_jobs_status', {cache: 'no-store'})
            .then(response => {
                if (!response.ok) {
                    throw new Error(`scan_jobs_status HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Sort the data array to ensure the latest scan is at the top
                // Queued jobs without last_run sort after active, before completed by id.
                data.sort((a, b) => {
                    const aBusy = isScanBusyStatus(a.status) ? 0 : isScanQueuedStatus(a.status) ? 1 : 2;
                    const bBusy = isScanBusyStatus(b.status) ? 0 : isScanQueuedStatus(b.status) ? 1 : 2;
                    if (aBusy !== bBusy) return aBusy - bBusy;
                    return new Date(b.last_run || 0) - new Date(a.last_run || 0);
                });
                
                // Clear the table body
                scanJobsTableBody.innerHTML = '';
                
                const isAnyJobRunning = data.some(j => isScanBusyStatus(j.status));
                scanBusy = isAnyJobRunning;
                
                data.forEach(job => {
                    const { processed, total, percentage } = progressCounts(job);
                    // Create progress column content
                    let progressColumn = '';
                    if (job.status === 'Running' && total > 0) {
                        progressColumn = `
                            <div class="scan-progress">
                                <div class="progress mb-1" style="height: 20px;">
                                    <div class="progress-bar" style="width: ${percentage}%"></div>
                                </div>
                                <div class="progress-info">
                                    <span class="progress-numbers">${processed}/${total} (${percentage}%)</span>
                                </div>
                                <div class="progress-status">
                                    <small class="text-bright-green">${job.current_processing || 'Processing...'}</small>
                                </div>
                            </div>
                        `;
                    } else if (job.status === 'Stopping') {
                        progressColumn = `
                            <div class="scan-progress">
                                <div class="progress-status">
                                    <span class="text-warning">
                                        <span class="gt-spinner gt-spinner--sm" aria-hidden="true"></span>
                                        Stopping… (${processed}/${total || '?'})
                                    </span>
                                </div>
                                <div class="progress-status">
                                    <small class="text-muted">Finishing in-flight folders, then cancelling the rest</small>
                                </div>
                            </div>
                        `;
                    } else if (isScanQueuedStatus(job.status)) {
                        const pos = job.queue_position != null ? ` #${job.queue_position}` : '';
                        progressColumn = `<span class="text-info">⏳ Queued${pos} — waiting for active scan</span>`;
                    } else if (job.status === 'Completed' || job.status === 'Scheduled') {
                        progressColumn = `<span class="text-success">✓ ${processed}/${total || processed}</span>`;
                    } else if (job.status === 'Cancelled') {
                        progressColumn = `<span class="text-warning">⏹ Stopped ${processed}/${total || processed}</span>`;
                    } else if (job.status === 'Failed') {
                        const cancelledMsg = job.error_message === 'Scan cancelled by user';
                        progressColumn = cancelledMsg
                            ? `<span class="text-warning">⏹ Stopped ${processed}/${total || processed}</span>`
                            : `<span class="text-danger">✗ ${processed}/${total || processed}</span>`;
                    } else {
                        progressColumn = total ? `${processed}/${total}` : '—';
                    }

                    // Create actions column content
                    let actionsColumn = '—';
                    if (job.status === 'Running') {
                        actionsColumn = `<form action="/cancel_scan_job/${job.id}" method="post" style="display: inline-block;">
                                <input type="hidden" name="csrf_token" value="${csrfToken}">
                                <button type="submit" class="btn btn-warning btn-sm" title="Cancel Scan">Stop</button>
                            </form>`;
                    } else if (job.status === 'Stopping') {
                        actionsColumn = `<button class="btn btn-warning btn-sm" disabled title="Scan is stopping, please wait...">
                                <span class="gt-spinner gt-spinner--sm" aria-hidden="true"></span>
                                Stopping…
                            </button>`;
                    } else if (isScanQueuedStatus(job.status)) {
                        actionsColumn = `<form action="/cancel_scan_job/${job.id}" method="post" style="display: inline-block;">
                                <input type="hidden" name="csrf_token" value="${csrfToken}">
                                <button type="submit" class="btn btn-outline-warning btn-sm" title="Cancel queued scan before it starts">Cancel queue</button>
                            </form>`;
                    } else if (isAnyJobRunning) {
                        // Offer restart that can queue/force via conflict modal once Backend wires flags.
                        actionsColumn = `<button type="button" class="btn btn-info btn-sm gt-scan-restart-busy"
                                data-restart-url="/restart_scan_job/${job.id}"
                                title="Another scan is running — queue or force restart">↻</button>`;
                    } else {
                        actionsColumn = `<form action="/restart_scan_job/${job.id}" method="post" style="display: inline-block;">
                                    <input type="hidden" name="csrf_token" value="${csrfToken}">
                                    <button type="submit" class="btn btn-info btn-sm" title="Restart Scan">↻</button>
                                </form>`;
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${job.id.substring(0, 8)}</td>
                        <td>${job.library_name || 'N/A'}</td>
                        <td>${job.scan_folder || 'N/A'}</td>
                        <td>${getDisplayStatus(job)}</td>
                        <td>${progressColumn}</td>
                        <td>${actionsColumn}</td>
                    `;
                    scanJobsTableBody.appendChild(row);
                });

                scanJobsTableBody.querySelectorAll('.gt-scan-restart-busy').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const url = btn.getAttribute('data-restart-url');
                        openScanConflictModal((policy) => {
                            const form = document.createElement('form');
                            form.method = 'post';
                            form.action = url;
                            const csrf = document.createElement('input');
                            csrf.type = 'hidden';
                            csrf.name = 'csrf_token';
                            csrf.value = csrfToken;
                            form.appendChild(csrf);
                            applyQueueFieldsToForm(form, policy);
                            document.body.appendChild(form);
                            form.submit();
                        });
                    });
                });
            })
            .catch(error => console.error('Error fetching scan jobs status:', error));
    };

    function interceptScanFormSubmit(form) {
        if (!form || form.dataset.scanConflictBound) return;
        form.dataset.scanConflictBound = '1';
        form.addEventListener('submit', function(event) {
            // Allow programmatic re-submit after modal choice.
            if (form.dataset.scanConflictProceed === '1') {
                form.dataset.scanConflictProceed = '0';
                return;
            }
            if (!scanBusy) {
                clearQueueFieldsFromForm(form);
                return;
            }
            event.preventDefault();
            openScanConflictModal((policy) => {
                applyQueueFieldsToForm(form, policy);
                form.dataset.scanConflictProceed = '1';
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.submit();
                }
            });
        });
    }

    interceptScanFormSubmit(autoScanForm);
    interceptScanFormSubmit(manualScanForm);

    const updateUnmatchedFolders = () => {
        showSpinner();
        return fetch('/api/unmatched_folders', {cache: 'no-store'})
            .then(response => response.json())
            .then(data => {
                // Clear the table body
                unmatchedTableBody.innerHTML = '';
                
                data.forEach(folder => {
                    const escapedPath = escapeHtml(folder.folder_path);
                    const folderName = String(folder.folder_path || '')
                        .replace(/\\/g, '/')
                        .split('/')
                        .filter(Boolean)
                        .pop() || '';
                    const escapedName = escapeHtml(folderName);
                    const ignoreLabel = folder.status === 'Ignore' ? 'Unignore' : 'Ignore';
                    const canMarkKind = folder.status === 'Unmatched'
                        || folder.status === 'Pending'
                        || folder.status === 'Duplicate';
                    // TODO(backend): unmatched list may omit suggested_kind until API reads proposal sidecars.
                    const suggestedRaw = folder.suggested_kind == null ? '' : String(folder.suggested_kind).trim().toLowerCase();
                    const suggestedKind = ['experience', 'emulator', 'tool'].includes(suggestedRaw)
                        ? suggestedRaw
                        : '';
                    const suggestedLabel = suggestedKind === 'experience'
                        ? 'Experience'
                        : suggestedKind === 'emulator'
                            ? 'Emulator'
                            : suggestedKind === 'tool'
                                ? 'Tool'
                                : '';
                    const markKindOrder = suggestedKind
                        ? [suggestedKind, ...['experience', 'emulator', 'tool'].filter((k) => k !== suggestedKind)]
                        : ['experience', 'emulator', 'tool'];
                    const markKindButtons = canMarkKind ? markKindOrder.map((itemKind) => {
                        const label = itemKind === 'experience'
                            ? 'Experience'
                            : itemKind === 'emulator'
                                ? 'Emulator'
                                : 'Tool';
                        const isSuggested = suggestedKind === itemKind;
                        const btnClass = isSuggested
                            ? 'btn btn-outline-success btn-sm mark-kind-btn is-suggested'
                            : 'btn btn-outline-light btn-sm mark-kind-btn';
                        const title = isSuggested
                            ? `Suggested: catalog as ${label} without an IGDB game match`
                            : `Catalog as ${label} without an IGDB game match`;
                        return `<button type="button" class="${btnClass}" data-folder-id="${escapeHtml(String(folder.id))}" data-item-kind="${itemKind}" data-name="${escapedName}" title="${escapeHtml(title)}">Mark as ${label}</button>`;
                    }).join('\n') : '';
                    const suggestedChip = suggestedKind
                        ? `<span class="unmatched-suggested-kind" title="Suggested kind from scan proposal (software path)">Suggested ${escapeHtml(suggestedLabel)}</span>`
                        : '';
                    const whyLine = formatWhyUnmatched(folder);
                    const matchScore = formatMatchScore(folder.match_score);
                    const showWhyLabel = folder.status === 'Unmatched' || folder.status === 'Pending';
                    const scoreHtml = matchScore
                        ? `<span class="unmatched-why__score" title="Match confidence score">${escapeHtml(matchScore)}</span>`
                        : '';
                    const whyHtml = (whyLine || matchScore)
                        ? `<span class="unmatched-why"${showWhyLabel ? '' : ' data-why-kind="status"'}>${
                            showWhyLabel
                                ? '<span class="unmatched-why__label">Why unmatched?</span> '
                                : ''
                          }${scoreHtml}${scoreHtml && whyLine ? ' ' : ''}${whyLine ? escapeHtml(whyLine) : ''}</span>`
                        : '';
                    const actionsColumn = `
                        <div class="unmatched-row-actions">
                        <button type="button" class="btn btn-outline-light btn-sm reveal-path-btn" data-path="${escapedPath}" title="Open path details popup (copy / companion explorer — does not leave this page)">Open path</button>
                        <button type="button" class="btn btn-outline-light btn-sm copy-path-btn" data-path="${escapedPath}" title="Copy folder path to clipboard">Copy path</button>
                        <form action="/add_game_manual" method="GET" style="display: inline;">
                            <input type="hidden" name="full_disk_path" value="${escapedPath}">
                            <input type="hidden" name="library_uuid" value="${escapeHtml(folder.library_uuid)}">
                            <input type="hidden" name="platform_name" value="${escapeHtml(folder.platform_name)}">
                            <input type="hidden" name="platform_id" value="${escapeHtml(folder.platform_id)}">
                            <input type="hidden" name="from_unmatched" value="true">
                            <button type="submit" class="btn btn-outline-light btn-sm" title="Identify as game: opens manual add with a cleaned game name prefilled">Identify as game</button>
                        </form>
                        ${markKindButtons}
                        <button
                            type="button"
                            onclick="window.toggleIgnoreStatus('${folder.id}', this)"
                            class="btn btn-outline-light btn-sm"
                            title="Ignored folders are not scanned">
                            ${ignoreLabel}
                        </button>
                        <button type="button" onclick="clearEntry('${folder.id}')" class="btn btn-outline-light btn-sm" title="Remove from unmatched list">Clear</button>
                        <form class="delete-folder-form" style="display: inline;">
                            <input type="hidden" name="csrf_token" value="${csrfToken}">
                            <input type="hidden" name="folder_path" value="${escapedPath}">
                            <button type="submit" class="btn btn-outline-light btn-sm" title="Delete the folder from disk">Delete</button>
                        </form>
                        </div>
                    `;
                    
                    const row = document.createElement('tr');
                    row.setAttribute('data-status', folder.status);
                    row.setAttribute('data-folder-path', folder.folder_path.toLowerCase());
                    row.setAttribute('data-library-name', folder.library_name.toLowerCase());
                    row.setAttribute('data-platform-name', folder.platform_name.toLowerCase());
                    row.innerHTML = `
                        <td class="col-path"><span class="unmatched-folder-path" title="${escapedPath}">${escapedPath}</span></td>
                        <td class="col-status"><span class="status-${folder.status.toLowerCase()}" title="${folder.status === 'Duplicate' ? 'Another library game already uses this IGDB match and the folder title looks like the same game' : (folder.status === 'Unmatched' ? 'Could not auto-match to IGDB (or IGDB already used by a different-titled folder)' : '')}">${folder.status === 'Duplicate' ? 'Duplicate (same title)' : folder.status}</span>${suggestedChip}${whyHtml}</td>
                        <td class="col-library">${escapeHtml(folder.library_name)}</td>
                        <td class="col-platform">${escapeHtml(folder.platform_name)}</td>
                        <td class="col-actions">${actionsColumn}</td>
                    `;
                    unmatchedTableBody.appendChild(row);
                });
                // Attach event listeners to the new forms
                attachDeleteFolderFormListeners();

                // Update results counter after data load
                updateResultsCounter();
            })
            .catch(error => {
                console.error('Error fetching unmatched folders:', error);
            })
            .finally(() => {
                hideSpinner();
            });
    };

    // Copy path / reveal path — event delegation so re-rendered rows stay wired
    // without re-escaping paths back into inline onclick strings (XSS-safe).
    function markUnmatchedKind(folderId, itemKind, name, button) {
        if (!folderId || !itemKind) return;
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        }
        const body = { item_kind: itemKind };
        if (name) body.name = name;
        const kindLabel = itemKind === 'experience'
            ? 'Experience'
            : itemKind === 'emulator'
                ? 'Emulator'
                : itemKind === 'tool'
                    ? 'Tool'
                    : itemKind;
        fetch(`/api/unmatched_folders/${encodeURIComponent(folderId)}/mark_kind`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(body),
        })
            .then((response) => response.json().catch(() => ({})).then((data) => {
                if (!response.ok) {
                    throw new Error(data.error || data.message || `mark_kind ${response.status}`);
                }
                return data;
            }))
            .then((data) => {
                showToast(
                    `Cataloged “${data.name || name || 'folder'}” as ${kindLabel} (no IGDB game match)`,
                    'success',
                );
                return updateUnmatchedFolders();
            })
            .catch((err) => {
                showToast(err?.message || `Could not mark as ${kindLabel}`, 'info');
            })
            .finally(() => {
                if (button) {
                    button.disabled = false;
                    button.removeAttribute('aria-busy');
                }
            });
    }

    if (unmatchedTableBody && !unmatchedTableBody.dataset.actionsWired) {
        unmatchedTableBody.addEventListener('click', function(event) {
            const copyBtn = event.target.closest('.copy-path-btn');
            if (copyBtn) {
                const path = copyBtn.dataset.path || '';
                copyPathToClipboard(path).then(ok => {
                    showToast(ok ? 'Path copied to clipboard' : 'Could not copy path', ok ? 'success' : 'info');
                });
                return;
            }

            const revealBtn = event.target.closest('.reveal-path-btn');
            if (revealBtn) {
                revealPath(revealBtn.dataset.path || '', revealBtn);
                return;
            }

            const markBtn = event.target.closest('.mark-kind-btn');
            if (markBtn) {
                markUnmatchedKind(
                    markBtn.dataset.folderId || '',
                    markBtn.dataset.itemKind || '',
                    markBtn.dataset.name || '',
                    markBtn,
                );
            }
        });
        unmatchedTableBody.dataset.actionsWired = 'true';
    }

    // Path popup — never navigate away to Auto Scan. Copy + optional companion open.
    function revealPath(path, button) {
        if (!path) return;

        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        }

        showOpenPathModal(path, {
            onDone: () => {
                if (button) {
                    button.disabled = false;
                    button.removeAttribute('aria-busy');
                }
            },
        });
    }

    function showOpenPathModal(path, { onDone } = {}) {
        const existing = document.getElementById('gt-open-path-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'gt-open-path-modal';
        overlay.className = 'gt-open-path-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
          <div class="gt-open-path-modal__panel">
            <div class="gt-open-path-modal__toolbar">
              <h2>Folder path</h2>
              <button type="button" class="gt-open-path-modal__close" aria-label="Close">×</button>
            </div>
            <p class="gt-open-path-modal__path"><code></code></p>
            <div class="gt-open-path-modal__actions">
              <button type="button" class="btn btn-primary btn-sm gt-open-path-copy">Copy path</button>
              <button type="button" class="btn btn-outline-light btn-sm gt-open-path-explorer">Open in file explorer</button>
            </div>
            <p class="gt-open-path-modal__status" role="status"></p>
          </div>
        `;
        const code = overlay.querySelector('code');
        code.textContent = path;
        const statusEl = overlay.querySelector('.gt-open-path-modal__status');

        function close() {
            overlay.remove();
            onDone?.();
        }

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close();
        });
        overlay.querySelector('.gt-open-path-modal__close').addEventListener('click', close);
        overlay.querySelector('.gt-open-path-copy').addEventListener('click', () => {
            copyPathToClipboard(path).then(() => {
                statusEl.textContent = 'Path copied to clipboard';
                showToast('Path copied to clipboard', 'success');
            });
        });
        overlay.querySelector('.gt-open-path-explorer').addEventListener('click', () => {
            statusEl.textContent = 'Queuing companion…';
            fetch('/api/client/commands', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ game_uuid: '', action: 'open_path', path, select: true }),
            })
                .then((response) => {
                    if (!response.ok) {
                        return response.json().catch(() => ({})).then((data) => {
                            throw new Error(data.error || `open_path ${response.status}`);
                        });
                    }
                    statusEl.textContent = 'Queued open in file explorer for companion';
                    showToast('Queued open in file explorer', 'success');
                })
                .catch((err) => {
                    return copyPathToClipboard(path).then(() => {
                        statusEl.textContent = `${err.message || 'Open failed'} — path copied as fallback`;
                        showToast('Path copied (explorer open unavailable)', 'info');
                    });
                });
        });

        if (!document.getElementById('gt-open-path-modal-style')) {
            const style = document.createElement('style');
            style.id = 'gt-open-path-modal-style';
            style.textContent = `
              .gt-open-path-modal{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(5,7,10,.82)}
              .gt-open-path-modal__panel{width:min(40rem,100%);display:flex;flex-direction:column;gap:.75rem;padding:1rem;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#141820;color:#f2f4f8}
              .gt-open-path-modal__toolbar{display:flex;justify-content:space-between;align-items:center;gap:.75rem}
              .gt-open-path-modal__toolbar h2{margin:0;font-size:1.05rem}
              .gt-open-path-modal__close{width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:#1c2230;color:#f2f4f8;font-size:1.35rem;cursor:pointer}
              .gt-open-path-modal__path{margin:0;padding:.75rem;border-radius:8px;background:#1c2230;word-break:break-all}
              .gt-open-path-modal__actions{display:flex;flex-wrap:wrap;gap:.5rem}
              .gt-open-path-modal__status{margin:0;font-size:.85rem;opacity:.8;min-height:1.2em}
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);
    }

    // Filtering functionality
    let currentFilter = 'all';
    let currentSearch = '';

    // Notification system
    function showSuccessNotification(message) {
        // Remove any existing notification
        const existingNotification = document.querySelector('.success-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.innerHTML = `
            ✓ <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 10);

        // Hide and remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function filterUnmatchedRows() {
        const unmatchedRows = document.querySelectorAll('#unmatchedFoldersTableBody tr');
        let visibleCount = 0;

        unmatchedRows.forEach(row => {
            const status = row.getAttribute('data-status');
            const folderPath = row.getAttribute('data-folder-path') || '';
            const libraryName = row.getAttribute('data-library-name') || '';
            const platformName = row.getAttribute('data-platform-name') || '';

            // Check status filter
            const statusMatch = currentFilter === 'all' || status === currentFilter;

            // Check search filter
            const searchMatch = currentSearch === '' ||
                folderPath.includes(currentSearch) ||
                libraryName.includes(currentSearch) ||
                platformName.includes(currentSearch);

            // Special handling for ignored items
            let shouldShow = statusMatch && searchMatch;

            // For Option 2 behavior: Hide ignored items unless viewing "All" or "Ignored"
            if (status === 'Ignore' && currentFilter !== 'all' && currentFilter !== 'Ignore') {
                shouldShow = false;
            }

            if (shouldShow) {
                row.style.display = '';
                row.classList.remove('row-fade-out'); // Remove fade-out class if present
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        updateResultsCounter(visibleCount, unmatchedRows.length);
    }

    function updateResultsCounter(visible = null, total = null) {
        const resultsInfo = document.getElementById('resultsInfo');
        if (!resultsInfo) return;

        if (visible === null || total === null) {
            const unmatchedRows = document.querySelectorAll('#unmatchedFoldersTableBody tr');
            total = unmatchedRows.length;
            visible = Array.from(unmatchedRows).filter(row => row.style.display !== 'none').length;
        }

        if (currentFilter === 'all' && currentSearch === '') {
            resultsInfo.textContent = `Showing all ${total} entries`;
        } else {
            const filterText = currentFilter !== 'all' ? ` (${currentFilter})` : '';
            const searchText = currentSearch ? ` matching "${currentSearch}"` : '';
            resultsInfo.textContent = `Showing ${visible} of ${total} entries${filterText}${searchText}`;
        }
    }

    // Keep the Export CSV/JSON links in sync with whichever status filter is
    // active, so a download reflects the tab the admin is currently looking at.
    function updateExportLinks() {
        ['exportUnmatchedCsvBtn', 'exportUnmatchedJsonBtn'].forEach(id => {
            const link = document.getElementById(id);
            if (!link) return;
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('status', currentFilter === 'all' ? 'all' : currentFilter);
            link.href = url.toString();
        });
    }

    function setupUnmatchedFilters() {
        // Filter button event listeners
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

                // Add active class to clicked button
                this.classList.add('active');

                // Update current filter
                currentFilter = this.getAttribute('data-filter');

                // Apply filtering
                filterUnmatchedRows();
                updateExportLinks();
            });
        });

        // Search input event listener
        const searchInput = document.getElementById('unmatchedSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentSearch = this.value.toLowerCase();
                filterUnmatchedRows();
            });
        }

        const reclassifyBtn = document.getElementById('reclassifyDuplicatesBtn');
        if (reclassifyBtn) {
            reclassifyBtn.addEventListener('click', function() {
                if (!confirm('Reclassify false Duplicate rows (different folder titles) as Unmatched?')) {
                    return;
                }
                reclassifyBtn.disabled = true;
                fetch('/api/unmatched_folders/reclassify_duplicates', {
                    method: 'POST',
                    headers: CSRFUtils.getHeaders({
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    })
                })
                    .then(r => r.json())
                    .then(data => {
                        showSuccessNotification(
                            `Fixed ${data.changed_count || 0} false duplicates` +
                            (data.kept_count ? `; kept ${data.kept_count} true duplicates` : '')
                        );
                        return updateUnmatchedFolders();
                    })
                    .then(() => filterUnmatchedRows())
                    .catch(err => console.error('Reclassify failed:', err))
                    .finally(() => { reclassifyBtn.disabled = false; });
            });
        }

        const backfillKindBtn = document.getElementById('backfillSuggestedKindBtn');
        if (backfillKindBtn) {
            backfillKindBtn.addEventListener('click', function() {
                if (!confirm(
                    'Backfill Suggested kind hints from on-disk scan proposals for rows that still have null hints? Safe to re-run; only updates empty hints.',
                )) {
                    return;
                }
                backfillKindBtn.disabled = true;
                fetch('/api/unmatched_folders/backfill_suggested_kind', {
                    method: 'POST',
                    headers: CSRFUtils.getHeaders({
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }),
                    body: JSON.stringify({}),
                })
                    .then(async (r) => {
                        const data = await r.json().catch(() => ({}));
                        if (!r.ok) {
                            throw new Error(data.error || data.message || 'Backfill failed');
                        }
                        return data;
                    })
                    .then(data => {
                        const updated = data.updated ?? 0;
                        const scanned = data.scanned ?? 0;
                        showSuccessNotification(
                            `Kind hints updated ${updated} of ${scanned} scanned` +
                            (data.skipped_no_sidecar
                                ? ` · ${data.skipped_no_sidecar} without proposal`
                                : ''),
                        );
                        return updateUnmatchedFolders();
                    })
                    .then(() => filterUnmatchedRows())
                    .catch(err => {
                        console.error('Backfill kind hints failed:', err);
                        showToast(err?.message || 'Backfill kind hints failed', 'error');
                    })
                    .finally(() => { backfillKindBtn.disabled = false; });
            });
        }
    }

    const refreshAllBtn = document.getElementById('refreshAllLibrariesBtn');
    if (refreshAllBtn) {
        refreshAllBtn.addEventListener('click', function() {
            if (!confirm('Refresh all libraries using each library’s last scan folder?')) {
                return;
            }

            function postRefreshAll(policy) {
                const fields = policy ? buildScanQueueRequestFields(policy) : {};
                refreshAllBtn.disabled = true;
                return fetch('/api/admin/libraries/refresh_all', {
                    method: 'POST',
                    headers: CSRFUtils.getHeaders({
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                    }),
                    body: JSON.stringify(fields),
                })
                    .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })).catch(() => ({
                        ok: r.ok,
                        status: r.status,
                        data: { error: 'Refresh failed' },
                    })))
                    .then(({ ok, status, data }) => {
                        if (isAlreadyRunningReject(status, data) && !policy) {
                            openScanConflictModal((chosen) => {
                                postRefreshAll(chosen);
                            });
                            return;
                        }
                        const toast = toastForScanStartResponse(data, ok);
                        showToast(toast.text, toast.variant);
                        if (ok) updateScanJobs();
                    })
                    .catch(err => {
                        console.error('Refresh all failed:', err);
                        showToast('Refresh all failed.', 'error');
                    })
                    .finally(() => { refreshAllBtn.disabled = false; });
            }

            if (scanBusy) {
                openScanConflictModal((policy) => postRefreshAll(policy));
                return;
            }
            postRefreshAll(null);
        });
    }

    // Set up filter controls
    setupUnmatchedFilters();
    updateExportLinks();

    // Run immediately on load
    updateScanJobs();
    updateUnmatchedFolders();

    // Set up periodic updates
    setInterval(updateScanJobs, 3000);  // Update every 3 seconds
    setInterval(() => {
        updateUnmatchedFolders().then(() => {
            // Reapply current filters after periodic refresh
            filterUnmatchedRows();
        });
    }, 30000);  // Update every 30 seconds

    // Global functions for table interactions
    window.toggleIgnoreStatus = function(folderId, button) {
        const row = button.closest('tr');
        const currentStatus = row.getAttribute('data-status');
        const isBeingIgnored = currentStatus !== 'Ignore';

        // Show immediate visual feedback
        if (isBeingIgnored) {
            // If we're ignoring the item and not viewing "All" or "Ignored", hide it immediately
            if (currentFilter !== 'all' && currentFilter !== 'Ignore') {
                row.classList.add('row-fade-out');
                setTimeout(() => {
                    row.style.display = 'none';
                    updateResultsCounter();
                }, 300);
            }
        }

        fetch(`/toggle_ignore_status/${folderId}`, {
            method: 'POST',
            headers: CSRFUtils.getHeaders({
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Show success notification
                const action = isBeingIgnored ? 'ignored' : 'un-ignored';
                showSuccessNotification(`Folder ${action} successfully`);

                // Update table data in background
                updateUnmatchedFolders().then(() => {
                    // Reapply current filters after data refresh
                    filterUnmatchedRows();
                });
            } else {
                // If there was an error, restore the row if it was hidden
                if (isBeingIgnored && currentFilter !== 'all' && currentFilter !== 'Ignore') {
                    row.classList.remove('row-fade-out');
                    row.style.display = '';
                }
                console.error('Error toggling ignore status:', data.message);
            }
        })
        .catch(error => {
            // If there was an error, restore the row if it was hidden
            if (isBeingIgnored && currentFilter !== 'all' && currentFilter !== 'Ignore') {
                row.classList.remove('row-fade-out');
                row.style.display = '';
            }
            console.error('Error toggling ignore status:', error);
        });
    };

    window.clearEntry = function(folderId) {
        if (confirm('Remove this entry from the unmatched list?')) {
            const button = event.target.closest('button');
            const row = button.closest('tr');

            // Immediate visual feedback - fade out the row
            row.classList.add('row-fade-out');
            setTimeout(() => {
                row.style.display = 'none';
                updateResultsCounter();
            }, 300);

            fetch(`/clear_unmatched_entry/${folderId}`, {
                method: 'POST',
                headers: CSRFUtils.getHeaders({
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showSuccessNotification('Entry removed successfully');

                    // Update table data in background
                    updateUnmatchedFolders().then(() => {
                        // Reapply current filters after data refresh
                        filterUnmatchedRows();
                    });
                } else {
                    // If there was an error, restore the row
                    row.classList.remove('row-fade-out');
                    row.style.display = '';
                    console.error('Error clearing entry:', data.message);
                }
            })
            .catch(error => {
                // If there was an error, restore the row
                row.classList.remove('row-fade-out');
                row.style.display = '';
                console.error('Error clearing entry:', error);
            });
        }
    };
});

// Folder browse setup function
function setupFolderBrowse(browseButtonId, folderContentsId, spinnerId, upButtonId, inputFieldId, currentPathVar) {
    // Store the initial library selection
    var initialLibrarySelection = $(inputFieldId).closest('form').find('select[name="library_uuid"]').val();
    
    $(browseButtonId).click(function() {
        window[currentPathVar] = ''; // Reset the current path
        $(upButtonId).hide(); // Initially hide the "Up" button
        // Preserve the library selection
        var librarySelect = $(inputFieldId).closest('form').find('select[name="library_uuid"]');
        if (!librarySelect.val() && initialLibrarySelection) {
            librarySelect.val(initialLibrarySelection);
        }
        fetchFolders('', folderContentsId, spinnerId, upButtonId, inputFieldId, currentPathVar);
    });

    $(upButtonId).click(function() {
        var segments = window[currentPathVar].split('/').filter(Boolean);
        if (segments.length > 0) {
            // Remove the last segment to go up one level
            segments.pop();
            if (segments.length > 0) {
                window[currentPathVar] = segments.join('/') + '/';
            } else {
                window[currentPathVar] = ''; // Reset to base directory if no segments left
            }
        } else {
            window[currentPathVar] = ''; // Already at base directory
        }

        fetchFolders(window[currentPathVar], folderContentsId, spinnerId, upButtonId, inputFieldId, currentPathVar);

        // Update the input field with the new current path
        $(inputFieldId).val(window[currentPathVar]);

        if (segments.length < 1) {
            $(upButtonId).hide();
        } else {
            $(upButtonId).show();
        }
    });
}

function fetchFolders(path, folderContentsId, spinnerId, upButtonId, inputFieldId, currentPathVar) {
    console.log("Fetching folders for path:", path);
    var $spinner = $(spinnerId);
    $spinner.css('display', 'inline-flex').show();
    if (window.GtLoadingMotifs && $spinner[0]) {
        window.GtLoadingMotifs.mount($spinner[0], { size: 'lg' });
    }
    $.ajax({
        url: '/api/browse_folders_ss',
        data: { path: path },
        success: function(data) {
            $spinner.hide();
            $(folderContentsId).empty();
            
            // Check if we're using the new response format or the old one
            const items = data.items || data;
            
            // Display warning if there were errors
            if (data.hasErrors) {
                $(folderContentsId).append(
                    $('<div class="alert alert-warning">').html(
                        `⚠ Some items (${data.skippedItems}) could not be accessed and were skipped.`
                    )
                );
            }
            
            items.forEach(function(item) {
                var itemElement;
                if (item.isDir) {
                    itemElement = $('<div>').html('📁 ' + item.name);
                    var fullPath = path + item.name + "/";
                    $(itemElement).addClass('folder-item').attr('data-path', fullPath);
                } else {
                    // Get file extension and appropriate icon
                    var ext = item.ext ? item.ext.toLowerCase() : '';
                    var iconClass = fileIcons[ext] || fileIcons['default'];
                    
                    // Format file size
                    var sizeText = formatFileSize(item.size);
                    
                    // Create file element with icon, name, and size
                    itemElement = $('<div>').html(
                        '' +  
                        item.name + 
                        '<span class="file-size">(' + sizeText + ')</span>'
                    );
                    $(itemElement)
                        .addClass('file-item')
                        .attr('title', item.name + ' - ' + sizeText)
                        .css('cursor', 'default');
                }
                $(folderContentsId).append(itemElement);
            });

            // Only attach click handlers to folders
            $('.folder-item').click(function() {
                var newPath = $(this).data('path');
                window[currentPathVar] = newPath; 
                fetchFolders(newPath, folderContentsId, spinnerId, upButtonId, inputFieldId, currentPathVar);
                $(inputFieldId).val(newPath); 
            });
            if (path) {
                $(upButtonId).show();
            } else {
                $(upButtonId).hide();
            }
        },
        error: function(error) {
            $spinner.hide();
            console.error("Error fetching folders:", error);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const kilobyte = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(kilobyte));
    return parseFloat((bytes / Math.pow(kilobyte, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Scan Filters tab — kind toggle, dir: prefix, quick-add chips (Wave 3). */
(function initScanFiltersExplainUi() {
    const DIR_PREFIX = 'dir:';
    const form = document.getElementById('gtScanFilterForm');
    if (!form) return;

    const rawInput = document.getElementById('filter_pattern_raw');
    const hiddenInput = document.getElementById('filter_pattern');
    const dirPrefixEl = document.getElementById('gtFilterDirPrefix');
    const labelEl = document.getElementById('gtFilterPatternLabel');
    const hintEl = document.getElementById('gtFilterPatternHint');
    const caseRow = document.getElementById('gtFilterCaseRow');
    const caseSelect = document.getElementById('case_sensitive');
    const modalEl = document.getElementById('addFilterModal');

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
        if (caseRow) {
            caseRow.hidden = kind === 'dir';
        }
        if (kind === 'dir' && caseSelect) {
            caseSelect.value = 'no';
        }
        if (rawInput) {
            rawInput.value = stripDirPrefix(rawInput.value);
        }
        syncHiddenFromRaw();
    }

    function fillFilterForm(kind, pattern, caseSensitive) {
        const kindRadio = form.querySelector(`input[name="gt_filter_kind"][value="${kind === 'dir' ? 'dir' : 'name'}"]`);
        if (kindRadio) kindRadio.checked = true;
        if (rawInput) rawInput.value = stripDirPrefix(pattern || '');
        if (caseSelect) caseSelect.value = caseSensitive === 'yes' ? 'yes' : 'no';
        applyKindUi();
    }

    form.querySelectorAll('input[name="gt_filter_kind"]').forEach((radio) => {
        radio.addEventListener('change', applyKindUi);
    });
    if (rawInput) {
        rawInput.addEventListener('input', syncHiddenFromRaw);
        rawInput.addEventListener('change', syncHiddenFromRaw);
    }
    form.addEventListener('submit', syncHiddenFromRaw);

    document.querySelectorAll('.gt-scan-filters__chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            fillFilterForm(
                chip.getAttribute('data-gt-filter-kind'),
                chip.getAttribute('data-gt-filter-pattern'),
                chip.getAttribute('data-gt-filter-case') || 'no'
            );
            if (modalEl && window.bootstrap && bootstrap.Modal) {
                bootstrap.Modal.getOrCreateInstance(modalEl).show();
            }
            if (rawInput) {
                rawInput.focus();
                rawInput.select();
            }
        });
    });

    if (modalEl) {
        modalEl.addEventListener('shown.bs.modal', () => {
            applyKindUi();
            if (rawInput && !rawInput.value) rawInput.focus();
        });
        modalEl.addEventListener('hidden.bs.modal', () => {
            fillFilterForm('name', '', 'no');
        });
    }

    applyKindUi();
})();
