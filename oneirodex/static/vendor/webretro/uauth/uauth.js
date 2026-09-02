/* Oneirodex stub — cloud-drive ROM pickers are unused in library embed. */
var uauth = {
  open: function () {
    if (typeof alert === 'function') {
      alert('Cloud drive upload is disabled in Oneirodex. Open the game from your library instead.');
    }
  },
};
