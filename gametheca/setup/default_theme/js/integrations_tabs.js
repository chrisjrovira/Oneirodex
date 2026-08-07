/**
 * Integrations Tabs Controller
 *
 * Handles tab switching with URL fragment support for persistent tab state.
 * All form functionality is handled by individual integration JS files.
 */

$(document).ready(function() {
    console.log('Integrations tabs controller loaded');

    // Map fragments to tab IDs
    const fragmentTabMap = {
        '#email': 'email-tab',
        '#igdb': 'igdb-tab'
    };

    // Element-agnostic: the old strip's triggers are <button data-bs-target>,
    // bar two's are <a href> (UIR-7). Both carry data-bs-toggle="tab" and both
    // live under #integrationTabs, so match on that and read whichever
    // attribute names the pane.
    function paneSelector(triggerEl) {
        return triggerEl.getAttribute('data-bs-target') || triggerEl.getAttribute('href');
    }

    const triggerTabList = [].slice.call(
        document.querySelectorAll('#integrationTabs [data-bs-toggle="tab"]')
    );

    triggerTabList.forEach(function (triggerEl) {
        triggerEl.addEventListener('shown.bs.tab', function (event) {
            const activeTab = event.target;
            const targetPaneId = paneSelector(activeTab);

            console.log('Tab switched to:', targetPaneId);

            // Update URL fragment when user manually switches tabs
            const newFragment = targetPaneId;
            if (window.location.hash !== newFragment) {
                history.replaceState(null, null, newFragment);
            }
        });
    });

    // Activate tab based on URL fragment
    function activateTabFromFragment() {
        const hash = window.location.hash || '#email'; // Default to email tab
        const tabId = fragmentTabMap[hash];

        if (tabId) {
            const tabElement = document.getElementById(tabId);
            if (tabElement) {
                // Use Bootstrap's tab API to activate the tab
                const tab = new bootstrap.Tab(tabElement);
                tab.show();
                console.log('Activated tab from fragment:', hash, '-> tab:', tabId);
                return true;
            }
        }

        // Fallback to email tab if fragment is invalid or missing
        const defaultTab = document.getElementById('email-tab');
        if (defaultTab) {
            const tab = new bootstrap.Tab(defaultTab);
            tab.show();
            console.log('Activated default email tab');
        }

        return false;
    }

    // Activate the correct tab on page load
    activateTabFromFragment();

    // Handle browser back/forward navigation
    window.addEventListener('hashchange', function() {
        console.log('Hash changed to:', window.location.hash);
        activateTabFromFragment();
    });

    console.log('Tab controller initialized with fragment support');

    // SMTP help lives inside .integrations-tab-content (backdrop-filter stacking
    // context). Host on body so the dialog stays above Bootstrap's backdrop.
    // (admin_manage_smtp_settings.js also wires this; keep both for load-order safety.)
    const smtpHelpModalEl = document.getElementById('smtpHelpModal');
    if (smtpHelpModalEl && smtpHelpModalEl.parentElement !== document.body) {
        document.body.appendChild(smtpHelpModalEl);
    }
    if (smtpHelpModalEl && window.bootstrap && bootstrap.Modal) {
        const smtpHelpModal = bootstrap.Modal.getOrCreateInstance(smtpHelpModalEl, {
            backdrop: true,
            keyboard: true,
            focus: true,
        });
        document.querySelectorAll('.smtp-help-open').forEach(function (btn) {
            // Avoid duplicate listeners if smtp settings JS already bound.
            if (btn.dataset.smtpHelpBound === '1') return;
            btn.dataset.smtpHelpBound = '1';
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                smtpHelpModal.show();
            });
        });
    }
});
