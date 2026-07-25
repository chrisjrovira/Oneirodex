/**
 * Preferences modal: theme swatch picker and preference saving.
 *
 * Timing: base.html loads this file from <head>, but the modal markup does not
 * exist then. It is fetched from settings.settings_panel and written into
 * #preferencesModalContainer only when the user opens Preferences, which is
 * long after DOMContentLoaded. Binding to #themeSelect or to the individual
 * swatches at load time therefore binds to nothing. Every listener below is
 * delegated from `document` instead: `document` exists before this script runs
 * and is never replaced, so the handlers keep working across any number of
 * modal injections.
 */
(function () {
    'use strict';

    var GRID_SELECTOR = '#themeSwatchGrid';
    // Tokens repainted for the live preview; --btn-primary is the legacy name
    // the older stylesheets still key on.
    var PREVIEW_TOKENS = ['--gt-accent', '--btn-primary'];

    // Inline values displaced by the preview, so closing without saving restores
    // exactly what was there before (null = no preview active).
    var displacedTokens = null;

    function notify(message, level) {
        if (window.jQuery && typeof window.jQuery.notify === 'function') {
            window.jQuery.notify(message, level);
        } else if (level === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    function swatches() {
        return Array.prototype.slice.call(
            document.querySelectorAll(GRID_SELECTOR + ' .theme-swatch')
        );
    }

    function syncSwatches(selected) {
        swatches().forEach(function (swatch) {
            var isSelected = swatch.dataset.theme === selected;
            swatch.classList.toggle('is-selected', isSelected);
            swatch.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    function syncFromSelect() {
        var select = document.getElementById('themeSelect');
        if (select) {
            syncSwatches(select.value);
        }
    }

    function swatchFor(value) {
        return swatches().filter(function (swatch) {
            return swatch.dataset.theme === value;
        })[0] || null;
    }

    /** The theme's accent, read off the rendered chip so JS holds no colours. */
    function accentOf(swatch) {
        var chip = swatch ? swatch.querySelector('.theme-swatch-chip') : null;
        if (!chip) {
            return null;
        }
        var colour = window.getComputedStyle(chip).backgroundColor;
        return colour && colour !== 'transparent' && colour !== 'rgba(0, 0, 0, 0)' ? colour : null;
    }

    function previewAccent(colour) {
        var root = document.documentElement;
        if (displacedTokens === null) {
            displacedTokens = PREVIEW_TOKENS.map(function (token) {
                return root.style.getPropertyValue(token);
            });
        }
        PREVIEW_TOKENS.forEach(function (token) {
            root.style.setProperty(token, colour);
        });
    }

    function clearPreview() {
        if (displacedTokens === null) {
            return;
        }
        var root = document.documentElement;
        PREVIEW_TOKENS.forEach(function (token, index) {
            var previous = displacedTokens[index];
            if (previous) {
                root.style.setProperty(token, previous);
            } else {
                root.style.removeProperty(token);
            }
        });
        displacedTokens = null;
    }

    function selectTheme(value) {
        var select = document.getElementById('themeSelect');
        if (select && select.value !== value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        applySelection(value);
    }

    function applySelection(value) {
        syncSwatches(value);
        var colour = accentOf(swatchFor(value));
        if (colour) {
            previewAccent(colour);
        }
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        var swatch = target && target.closest ? target.closest('.theme-swatch') : null;
        if (!swatch || !swatch.closest(GRID_SELECTOR)) {
            return;
        }
        selectTheme(swatch.dataset.theme);
    });

    // `change` bubbles, so the native <select> reaches us the same way.
    document.addEventListener('change', function (event) {
        if (event.target && event.target.id === 'themeSelect') {
            applySelection(event.target.value);
        }
    });

    // An unsaved preview must not outlive the modal.
    document.addEventListener('hidden.bs.modal', function (event) {
        if (event.target && event.target.id === 'preferencesModal') {
            clearPreview();
        }
    });

    document.addEventListener('submit', function (event) {
        var form = event.target;
        if (!form || form.id !== 'preferencesForm') {
            return;
        }
        event.preventDefault();

        fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: CSRFUtils.getHeaders()
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(function (data) {
            if (!data.success) {
                Object.values(data.errors || {}).forEach(function (error) {
                    notify(error[0], 'error');
                });
                return;
            }

            // The preview now matches what was saved, so let it stand until the
            // reload swaps in the real stylesheet.
            displacedTokens = null;

            var modalElement = document.getElementById('preferencesModal');
            var modal = window.bootstrap && modalElement
                ? window.bootstrap.Modal.getInstance(modalElement)
                : null;
            if (modal) {
                modal.hide();
            }

            notify(data.message, 'success');
            setTimeout(function () { window.location.reload(); }, 1000);
        })
        .catch(function (error) {
            console.error('Error:', error);
            notify('An error occurred while saving preferences', 'error');
        });
    });

    /**
     * Mark the saved theme as selected as soon as the modal is injected.
     * Scoped to the container base.html writes into, so this costs nothing on
     * the rest of the page.
     */
    function watchModalContainer() {
        var container = document.getElementById('preferencesModalContainer');
        if (!container || typeof MutationObserver === 'undefined') {
            return;
        }
        new MutationObserver(syncFromSelect).observe(container, { childList: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchModalContainer);
    } else {
        watchModalContainer();
    }

    // Exposed for pages that render the picker inline rather than injecting it.
    window.syncThemeSwatches = syncFromSelect;
})();
