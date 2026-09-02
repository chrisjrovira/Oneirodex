/**
 * Delegated DOM actions for classic Jinja pages.
 *
 * Inline event handlers (onclick=, onchange=, onsubmit=) are executable script
 * as far as CSP is concerned. After the <script> extract, those attributes were
 * the remaining reason Flask CSP still carried 'unsafe-inline' on script-src.
 * Templates now declare intent on data-* and this listener runs the named
 * global — the same functions the onclick used to call.
 *
 * data-od-click="fn"           → window.fn(optional data-od-arg)
 * data-od-click="reload"       → location.reload()
 * data-od-change="fn"          → window.fn(element.value, optional data-od-arg2)
 * data-od-open="url"           → window.open(url) (does not cancel submit)
 * data-od-confirm="message"    → window.confirm; cancel the click/submit if no
 *
 * Invite copy URLs stay on the button as data-od-arg so a shared file never
 * has to bake a token.
 */
(function () {
  'use strict';

  function namedFn(name) {
    if (!name) return null;
    var fn = window[name];
    return typeof fn === 'function' ? fn : null;
  }

  function parseArg(raw) {
    if (raw == null || raw === '') return undefined;
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
    return raw;
  }

  function confirmMessage(el) {
    var msg = el.getAttribute('data-od-confirm');
    if (!msg) return true;
    return window.confirm(msg);
  }

  document.addEventListener(
    'click',
    function (event) {
      var confirmEl = event.target.closest('[data-od-confirm]');
      if (confirmEl && confirmEl.tagName !== 'FORM') {
        if (!confirmMessage(confirmEl)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      var openEl = event.target.closest('[data-od-open]');
      if (openEl) {
        var url = openEl.getAttribute('data-od-open');
        if (url) window.open(url);
        return;
      }

      var clickEl = event.target.closest('[data-od-click]');
      if (!clickEl) return;

      var name = clickEl.getAttribute('data-od-click');
      if (name === 'reload') {
        event.preventDefault();
        window.location.reload();
        return;
      }

      var fn = namedFn(name);
      if (!fn) return;
      event.preventDefault();
      var arg = parseArg(clickEl.getAttribute('data-od-arg'));
      var arg2raw = clickEl.getAttribute('data-od-arg2');
      if (arg2raw != null && arg2raw !== '') {
        fn(arg, parseArg(arg2raw));
        return;
      }
      if (arg === undefined) fn(clickEl);
      else fn(arg, clickEl);
    },
    true
  );

  document.addEventListener('change', function (event) {
    var el = event.target.closest('[data-od-change]');
    if (!el) return;
    var fn = namedFn(el.getAttribute('data-od-change'));
    if (!fn) return;
    var arg2 = el.getAttribute('data-od-arg2');
    if (arg2) fn(el.value, arg2);
    else fn(el.value);
  });

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || form.tagName !== 'FORM') return;
      if (!form.hasAttribute('data-od-confirm')) return;
      if (!confirmMessage(form)) event.preventDefault();
    },
    true
  );
})();
