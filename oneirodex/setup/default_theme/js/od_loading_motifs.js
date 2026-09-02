/**
 * Loading motif picker (Wave 2d).
 * Consumes GET /api/loading-icon — rotate catalogue or lock to one id.
 * Ids: dpad | disc | stick | handheld | cart | crt (GT-B23).
 * Markup is generated from LoadingMotif.jsx so the SPA and the Jinja pages
 * cannot drift — that drift is what left classic pages on the old set.
 */
(function (global) {
  'use strict';

  var CATALOGUE = ['dpad', 'disc', 'stick', 'handheld', 'cart', 'crt'];
  var ENDPOINT = '/api/loading-icon';
  var cache = null;
  var cachePromise = null;
  var sessionPick = null;

  var MARKUP = {
    dpad:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="od-loading-motif__pad" x="18" y="8" width="12" height="32" rx="2"></rect><rect class="od-loading-motif__pad" x="8" y="18" width="32" height="12" rx="2"></rect><circle class="od-loading-motif__dpad-press" cx="24" cy="13" r="3"></circle><circle class="od-loading-motif__dpad-press od-loading-motif__dpad-press--r" cx="35" cy="24" r="3"></circle><circle class="od-loading-motif__dpad-press od-loading-motif__dpad-press--d" cx="24" cy="35" r="3"></circle><circle class="od-loading-motif__dpad-press od-loading-motif__dpad-press--l" cx="13" cy="24" r="3"></circle></svg>',
    disc:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><g class="od-loading-motif__platter"><circle class="od-loading-motif__disc-edge" cx="24" cy="24" r="15"></circle><path class="od-loading-motif__disc-glint" d="M24 9a15 15 0 0 1 13 7.5"></path></g><circle class="od-loading-motif__disc-hub" cx="24" cy="24" r="4"></circle><rect class="od-loading-motif__head" x="23" y="30" width="2" height="12" rx="1"></rect></svg>',
    stick:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="od-loading-motif__gate" cx="24" cy="24" r="15"></circle><g class="od-loading-motif__stick"><circle class="od-loading-motif__stick-cap" cx="24" cy="24" r="7"></circle></g></svg>',
    handheld:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="od-loading-motif__shell" x="12" y="6" width="24" height="36" rx="3"></rect><rect class="od-loading-motif__screen" x="16" y="11" width="16" height="13" rx="1"></rect><rect class="od-loading-motif__scanline" x="16" y="12" width="16" height="2"></rect><circle class="od-loading-motif__led" cx="16.5" cy="28.5" r="1.5"></circle><rect class="od-loading-motif__pad" x="17" y="32" width="7" height="2.2" rx="1"></rect><rect class="od-loading-motif__pad" x="19.4" y="29.6" width="2.2" height="7" rx="1"></rect></svg>',
    cart:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="od-loading-motif__slot" d="M11 30h26v10H11z"></path><g class="od-loading-motif__cart"><rect class="od-loading-motif__cart-body" x="15" y="8" width="18" height="20" rx="2"></rect><rect class="od-loading-motif__cart-label" x="18" y="11" width="12" height="7" rx="1"></rect><path class="od-loading-motif__cart-pins" d="M18 25h12"></path></g></svg>',
    crt:
      '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="od-loading-motif__tube" x="7" y="10" width="34" height="24" rx="4"></rect><rect class="od-loading-motif__raster" x="10" y="13" width="28" height="4"></rect><path class="od-loading-motif__stand" d="M19 34v4h10v-4M15 38h18"></path></svg>'
  };

  function normalizeId(id) {
    var text = String(id || '').trim().toLowerCase();
    return CATALOGUE.indexOf(text) >= 0 ? text : null;
  }

  function randomId(list) {
    var pool = list && list.length ? list : CATALOGUE;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function fetchSettings() {
    if (cache) {
      return Promise.resolve(cache);
    }
    if (cachePromise) {
      return cachePromise;
    }
    cachePromise = fetch(ENDPOINT, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('loading-icon ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        cache = data || {};
        return cache;
      })
      .catch(function () {
        cache = {
          loading_icon_mode: 'rotate',
          loading_icon_id: null,
          resolved_id: null,
          catalogue: CATALOGUE.map(function (id) {
            return { id: id };
          }),
        };
        return cache;
      });
    return cachePromise;
  }

  function resolveId(settings) {
    var locked = normalizeId(settings && (settings.resolved_id || settings.loading_icon_id));
    if (settings && settings.loading_icon_mode === 'lock' && locked) {
      return locked;
    }
    if (sessionPick && normalizeId(sessionPick)) {
      return sessionPick;
    }
    var ids = CATALOGUE;
    if (settings && Array.isArray(settings.catalogue) && settings.catalogue.length) {
      ids = settings.catalogue
        .map(function (row) {
          return normalizeId(row && row.id);
        })
        .filter(Boolean);
      if (!ids.length) {
        ids = CATALOGUE;
      }
    }
    sessionPick = randomId(ids);
    return sessionPick;
  }

  function buildNode(id, sizeClass) {
    // 'ring' was the old default and is no longer in MARKUP (GT-B23).
    var motif = normalizeId(id) || 'dpad';
    var el = document.createElement('span');
    el.className = 'od-loading-motif' + (sizeClass ? ' ' + sizeClass : '');
    el.setAttribute('data-motif', motif);
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MARKUP[motif] || MARKUP.ring;
    return el;
  }

  /**
   * Replace .od-spinner (or empty mount) inside *root* with a motif.
   * @param {Element} root
   * @param {{ size?: string, forceId?: string }} [opts]
   */
  function mount(root, opts) {
    if (!root) {
      return Promise.resolve(null);
    }
    opts = opts || {};
    return fetchSettings().then(function (settings) {
      var id = normalizeId(opts.forceId) || resolveId(settings);
      var sizeClass = opts.size === 'sm' ? 'od-loading-motif--sm'
        : opts.size === 'lg' ? 'od-loading-motif--lg' : 'od-loading-motif--lg';
      var node = buildNode(id, sizeClass);
      var spinner = root.querySelector('.od-spinner, .od-loading-motif');
      if (spinner) {
        spinner.replaceWith(node);
      } else {
        root.insertBefore(node, root.firstChild);
      }
      root.setAttribute('data-loading-motif', id);
      return node;
    });
  }

  function enhanceAll(selector) {
    var nodes = document.querySelectorAll(selector || '.od-loading-overlay, .loading-spinner, .spinner-overlay .spinner-container');
    return fetchSettings().then(function (settings) {
      var id = resolveId(settings);
      Array.prototype.forEach.call(nodes, function (root) {
        mount(root, { forceId: id, size: 'lg' });
      });
      return id;
    });
  }

  var blockingNode = null;
  var blockingDepth = 0;

  /**
   * Darken the page and show the member's motif (W27-D6).
   *
   * Reference-counted: two overlapping requests must not leave the overlay up
   * when the first finishes, and must not tear it down while the second is
   * still running. Callers pair every showBlocking() with a hideBlocking().
   */
  function showBlocking(message) {
    blockingDepth += 1;
    if (blockingNode) {
      return Promise.resolve(blockingNode);
    }

    var host = document.createElement('div');
    host.className = 'od-loading-overlay od-loading-overlay--blocking';
    // Announced politely rather than assertively: this interrupts nothing the
    // reader was doing, it just explains the wait.
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    if (message) {
      var label = document.createElement('p');
      label.className = 'od-loading-overlay__label';
      label.textContent = message;
      host.appendChild(label);
    }
    document.body.appendChild(host);
    blockingNode = host;

    // Caught, not just returned: nothing awaits this, so a throw inside mount's
    // DOM work would surface as an unhandled rejection. The overlay is already
    // in the document by this point and hideBlocking() still clears it, so the
    // failure mode without the motif is a plain darkened backdrop — which is
    // still a working busy signal.
    return mount(host, { size: 'lg' })
      .then(function () {
        // The label follows the motif visually; mount() inserts the motif at the
        // top of the host, which puts it before the label already.
        return host;
      })
      .catch(function () {
        return host;
      });
  }

  function hideBlocking() {
    blockingDepth = Math.max(0, blockingDepth - 1);
    if (blockingDepth > 0 || !blockingNode) {
      return;
    }
    if (blockingNode.parentNode) {
      blockingNode.parentNode.removeChild(blockingNode);
    }
    blockingNode = null;
  }

  global.GtLoadingMotifs = {
    CATALOGUE: CATALOGUE,
    showBlocking: showBlocking,
    hideBlocking: hideBlocking,
    fetchSettings: fetchSettings,
    resolveId: resolveId,
    mount: mount,
    enhanceAll: enhanceAll,
    buildNode: buildNode,
    clearCache: function () {
      cache = null;
      cachePromise = null;
      sessionPick = null;
    },
  };

  /**
   * Auto-enhance page-level loaders on classic pages (UID-008a).
   *
   * The six animated motifs shipped SPA-only. This file was loaded by all three
   * base templates and exposed enhanceAll() — but nothing ever called it, so
   * roughly forty-seven Jinja pages kept the plain `.od-spinner`. Built, and
   * never switched on.
   *
   * Wired here rather than in each template so a new page cannot forget it.
   * Deliberately scoped to enhanceAll()'s page-level containers: a bare
   * `.od-spinner` inside a button is a 14px inline mark, and swapping that for
   * a 48px motif would wreck the control it sits in.
   */
  function autoEnhance() {
    // Both guards are needed, and for different failures: try/catch covers a
    // synchronous throw before the promise exists, .catch covers a rejection
    // inside it. A synchronous try/catch alone would let an async failure
    // escape as an unhandled rejection, which is not what "must never take a
    // page down with it" should mean.
    try {
      var pending = enhanceAll();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(function () {
          // Decoration must never take a page down with it.
        });
      }
    } catch (e) {
      // Same rule, synchronous path.
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
