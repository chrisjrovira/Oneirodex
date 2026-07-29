/**
 * GameTheca modal stacking safety.
 *
 * Bootstrap appends `.modal-backdrop` to `document.body`. Any `.modal.fade`
 * nested under a stacking context (e.g. `backdrop-filter` on glass panels /
 * integrations tabs / scan jobs) ends up *under* that backdrop — dialog
 * buttons look present but do not receive clicks.
 *
 * Always host Bootstrap fade modals on `document.body` before show.
 */
(function () {
  function hoistBootstrapModals(root) {
    var scope = root || document;
    var modals = scope.querySelectorAll
      ? scope.querySelectorAll('.modal.fade')
      : [];
    if (!modals.length && scope.classList && scope.classList.contains('modal') && scope.classList.contains('fade')) {
      modals = [scope];
    }
    Array.prototype.forEach.call(modals, function (el) {
      if (!el || !el.parentElement) return;
      if (el.parentElement === document.body) return;
      document.body.appendChild(el);
    });
  }

  function onReady() {
    hoistBootstrapModals(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  // Preferences and other AJAX-injected modals land after first paint.
  window.gtHoistBootstrapModals = hoistBootstrapModals;

  document.addEventListener(
    'show.bs.modal',
    function (event) {
      var el = event.target;
      if (el && el.classList && el.classList.contains('modal')) {
        if (el.parentElement && el.parentElement !== document.body) {
          document.body.appendChild(el);
        }
      }
    },
    true,
  );
})();
