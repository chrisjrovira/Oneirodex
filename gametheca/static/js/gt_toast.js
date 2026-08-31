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
 *
 * Stack cap matches frontend/shared/toastStack.js: five info/success toasts
 * stay individual; a sixth collapses to “N notifications”. Errors/warns do not.
 */
(function () {
  'use strict';

  var HOST_ID = 'gt-toast-host';
  var TONES = { info: 1, success: 1, error: 1, warn: 1 };
  var MAX_INDIVIDUAL_TOASTS = 5;

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

  function isStackableTone(tone) {
    return tone === 'info' || tone === 'success';
  }

  function stackSummaryMessage(count) {
    var n = Math.max(0, Math.floor(Number(count) || 0));
    return n + ' notification' + (n === 1 ? '' : 's');
  }

  function visibleStackable(host) {
    return Array.prototype.filter.call(host.children, function (el) {
      return (
        el.className.indexOf('gt-toast--out') === -1 &&
        (el.className.indexOf('gt-toast--info') !== -1 ||
          el.className.indexOf('gt-toast--success') !== -1)
      );
    });
  }

  function stackCountOf(el) {
    var n = Number(el.getAttribute('data-toast-count'));
    return n && n > 0 ? n : 1;
  }

  function bindToastLifecycle(el, host) {
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
    function abort() {
      window.clearTimeout(removeTimer);
      window.clearTimeout(outTimer);
    }
    function restart() {
      abort();
      el.classList.remove('gt-toast--out');
      removeTimer = window.setTimeout(remove, 3200);
    }
    el._gtAbort = abort;
    el._gtRestart = restart;
    el._gtDismiss = remove;
    removeTimer = window.setTimeout(remove, 3200);
    return remove;
  }

  function paintToast(host, message, safeTone, stacked, count) {
    var el = document.createElement('div');
    el.className = 'gt-toast gt-toast--' + safeTone;
    if (stacked) {
      el.setAttribute('data-toast-stack', '1');
      el.setAttribute('data-toast-count', String(count));
    }

    var text = document.createElement('span');
    text.className = 'gt-toast__text';
    text.textContent = String(message);
    el.appendChild(text);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'gt-toast__close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '\u00d7';
    el.appendChild(close);

    host.appendChild(el);
    var dismiss = bindToastLifecycle(el, host);
    close.addEventListener('click', dismiss);
    return dismiss;
  }

  function showToast(message, tone) {
    if (typeof document === 'undefined' || !message) {
      return function () {};
    }
    var host = toastHost();
    var safeTone = normalizeTone(tone);

    if (isStackableTone(safeTone)) {
      var stacked = visibleStackable(host);
      var summary = null;
      var stackedCount = 0;
      var i;
      for (i = 0; i < stacked.length; i += 1) {
        stackedCount += stackCountOf(stacked[i]);
        if (stacked[i].getAttribute('data-toast-stack') === '1') {
          summary = stacked[i];
        }
      }
      if (summary) {
        var next = stackCountOf(summary) + 1;
        summary.setAttribute('data-toast-count', String(next));
        var summaryText = summary.querySelector('.gt-toast__text');
        if (summaryText) {
          summaryText.textContent = stackSummaryMessage(next);
        }
        if (typeof summary._gtRestart === 'function') {
          summary._gtRestart();
        }
        return summary._gtDismiss;
      }
      if (stackedCount + 1 > MAX_INDIVIDUAL_TOASTS) {
        for (i = 0; i < stacked.length; i += 1) {
          if (typeof stacked[i]._gtAbort === 'function') {
            stacked[i]._gtAbort();
          }
          if (stacked[i].parentNode) {
            stacked[i].parentNode.removeChild(stacked[i]);
          }
        }
        return paintToast(
          host,
          stackSummaryMessage(stackedCount + 1),
          safeTone,
          true,
          stackedCount + 1,
        );
      }
    }

    return paintToast(host, String(message), safeTone, false, 1);
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
    jq.notify = function (msg, type) {
      showToast(msg, type);
    };
  }

  installNotifyBridge();
})();
