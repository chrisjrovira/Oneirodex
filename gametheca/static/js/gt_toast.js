/**
 * Shared aurora toast for classic Jinja pages (UX-B7).
 *
 * Member and admin SPAs already use their own showToast. Classic pages still
 * called jQuery $.notify, which is a different shape, not dismissible, and
 * not the top-right host the rest of the product uses.
 *
 * Load after vendor/notify so this can replace $.notify. Theme copies of
 * gtShowAdminToast that run later are left alone if they already exist —
 * this script sets the function first so those IIFEs skip their fallback.
 */
(function () {
  'use strict';

  var HOST_ID = 'gt-toast-host';
  var TONES = { info: 1, success: 1, error: 1, warn: 1 };

  function toastHost() {
    var host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.className = 'gt-toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function normalizeTone(tone) {
    var raw = String(tone || 'info');
    if (raw === 'danger') return 'error';
    if (raw === 'warning') return 'warn';
    return TONES[raw] ? raw : 'info';
  }

  function showToast(message, tone) {
    if (typeof document === 'undefined' || !message) {
      return function () {};
    }
    var host = toastHost();
    var el = document.createElement('div');
    el.className = 'gt-toast gt-toast--' + normalizeTone(tone);

    var text = document.createElement('span');
    text.className = 'gt-toast__text';
    text.textContent = String(message);
    el.appendChild(text);

    var removeTimer = 0;
    var outTimer = 0;
    function remove() {
      window.clearTimeout(removeTimer);
      window.clearTimeout(outTimer);
      el.classList.add('gt-toast--out');
      outTimer = window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (host && !host.childElementCount && host.parentNode) {
          host.parentNode.removeChild(host);
        }
      }, 220);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'gt-toast__close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '\u00d7';
    close.addEventListener('click', remove);
    el.appendChild(close);

    host.appendChild(el);
    removeTimer = window.setTimeout(remove, 3200);
    return remove;
  }

  window.gtShowToast = showToast;
  if (typeof window.gtShowAdminToast !== 'function') {
    window.gtShowAdminToast = showToast;
  }

  function installNotifyBridge() {
    var jq = window.jQuery || window.$;
    if (!jq || typeof jq.notify !== 'function') {
      return;
    }
    jq.notify = function (message, type) {
      showToast(message, type);
    };
  }

  installNotifyBridge();
})();
