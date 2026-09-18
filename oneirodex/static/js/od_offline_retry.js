/* Offline page: retry, and come back on its own when the network returns.
 * Extracted from the template so the page carries no inline <script>. */
(function () {
  var button = document.getElementById('od-offline-retry');
  function retry() {
    window.location.replace('/library');
  }
  if (button) {
    button.addEventListener('click', retry);
  }
  window.addEventListener('online', retry);
})();
