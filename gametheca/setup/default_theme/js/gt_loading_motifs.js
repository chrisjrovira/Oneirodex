/**
 * Loading motif picker (Wave 2d).
 * Consumes GET /api/loading-icon — rotate catalogue or lock to one id.
 * Ids: ring | orbit | pulse | blocks | scan | arcade
 */
(function (global) {
  'use strict';

  var CATALOGUE = ['ring', 'orbit', 'pulse', 'blocks', 'scan', 'arcade'];
  var ENDPOINT = '/api/loading-icon';
  var cache = null;
  var cachePromise = null;
  var sessionPick = null;

  var MARKUP = {
    ring:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle class="gt-loading-motif__ring" cx="24" cy="24" r="16"></circle>' +
      '</svg>',
    orbit:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle class="gt-loading-motif__disc" cx="24" cy="24" r="14"></circle>' +
      '<circle class="gt-loading-motif__hub" cx="24" cy="24" r="3.5"></circle>' +
      '<g class="gt-loading-motif__sat">' +
      '<circle cx="24" cy="8" r="3"></circle>' +
      '</g>' +
      '<g class="gt-loading-motif__sat gt-loading-motif__sat--b">' +
      '<circle cx="38" cy="28" r="2.25"></circle>' +
      '</g>' +
      '</svg>',
    pulse:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<circle class="gt-loading-motif__pulse" cx="24" cy="24" r="16"></circle>' +
      '<circle class="gt-loading-motif__pulse gt-loading-motif__pulse--b" cx="24" cy="24" r="10"></circle>' +
      '<circle class="gt-loading-motif__core" cx="24" cy="24" r="4"></circle>' +
      '</svg>',
    blocks:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<rect class="gt-loading-motif__block" x="6" y="22" width="8" height="8" rx="1"></rect>' +
      '<rect class="gt-loading-motif__block" x="16" y="22" width="8" height="8" rx="1"></rect>' +
      '<rect class="gt-loading-motif__block" x="26" y="22" width="8" height="8" rx="1"></rect>' +
      '<rect class="gt-loading-motif__block" x="36" y="22" width="6" height="8" rx="1"></rect>' +
      '</svg>',
    scan:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<rect class="gt-loading-motif__frame" x="8" y="10" width="32" height="28" rx="2"></rect>' +
      '<rect class="gt-loading-motif__beam" x="10" y="12" width="28" height="3" rx="1"></rect>' +
      '</svg>',
    arcade:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path class="gt-loading-motif__slot" d="M14 34h20M16 34v-8h16v8"></path>' +
      '<ellipse class="gt-loading-motif__coin" cx="24" cy="14" rx="7" ry="7"></ellipse>' +
      '</svg>',
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
    var motif = normalizeId(id) || 'ring';
    var el = document.createElement('span');
    el.className = 'gt-loading-motif' + (sizeClass ? ' ' + sizeClass : '');
    el.setAttribute('data-motif', motif);
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = MARKUP[motif] || MARKUP.ring;
    return el;
  }

  /**
   * Replace .gt-spinner (or empty mount) inside *root* with a motif.
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
      var sizeClass = opts.size === 'sm' ? 'gt-loading-motif--sm'
        : opts.size === 'lg' ? 'gt-loading-motif--lg' : 'gt-loading-motif--lg';
      var node = buildNode(id, sizeClass);
      var spinner = root.querySelector('.gt-spinner, .gt-loading-motif');
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
    var nodes = document.querySelectorAll(selector || '.gt-loading-overlay, .loading-spinner, .spinner-overlay .spinner-container');
    return fetchSettings().then(function (settings) {
      var id = resolveId(settings);
      Array.prototype.forEach.call(nodes, function (root) {
        mount(root, { forceId: id, size: 'lg' });
      });
      return id;
    });
  }

  global.GtLoadingMotifs = {
    CATALOGUE: CATALOGUE,
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
})(typeof window !== 'undefined' ? window : this);
