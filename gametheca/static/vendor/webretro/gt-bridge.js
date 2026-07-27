/**
 * GameTheca ↔ WebRetro postMessage bridge (Wave 12 / O1 polish).
 * Loaded after assets/base.js so romName / getIdbItem / FS / Module are in scope.
 */
(function () {
  'use strict';

  var EXPORT_DELAYS_MS = [250, 600, 1200];

  function b64FromU8(u8) {
    if (!u8) return null;
    var bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
    var s = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  function u8FromB64(b64) {
    if (!b64) return null;
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Prefer battery SRAM, then memory cards / generic .sav (PS1 and friends). */
  function pickSramBytes(saveArr) {
    if (!saveArr || !saveArr.length) return null;
    var preferred = null;
    var rank = function (ext) {
      var e = (ext || '').toLowerCase();
      if (e === '.srm' || /\.srm$/i.test(e)) return 3;
      if (e === '.mcr' || /\.mcr$/i.test(e)) return 2;
      if (e === '.sav' || /\.sav$/i.test(e)) return 1;
      return 0;
    };
    var bestRank = -1;
    for (var i = 0; i < saveArr.length; i++) {
      var entry = saveArr[i];
      if (!entry || !entry.data) continue;
      var r = rank(entry.ext || '');
      if (r > bestRank) {
        bestRank = r;
        preferred = entry.data;
      } else if (bestRank < 0) {
        preferred = entry.data;
        bestRank = 0;
      }
    }
    return preferred ? (preferred instanceof Uint8Array ? preferred : new Uint8Array(preferred)) : null;
  }

  function tryLoadState() {
    try {
      if (typeof Module !== 'undefined' && typeof Module._cmd_load_state === 'function') {
        Module._cmd_load_state();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function collectExportPayload() {
    var stateP = typeof getIdbItem === 'function'
      ? getIdbItem('RetroArch_states_' + romName)
      : Promise.resolve(null);
    var saveP = typeof getIdbItem === 'function'
      ? getIdbItem('RetroArch_saves_' + romName)
      : Promise.resolve(null);
    return Promise.all([stateP, saveP]).then(function (pair) {
      var state = pair[0];
      var saveArr = pair[1];
      if (
        !state &&
        typeof FS !== 'undefined' &&
        FS.analyzePath('/home/web_user/retroarch/userdata/states/rom.state').exists
      ) {
        state = FS.readFile('/home/web_user/retroarch/userdata/states/rom.state');
      }
      var sram = pickSramBytes(saveArr);
      return {
        ok: true,
        romName: romName,
        stateB64: state ? b64FromU8(state instanceof Uint8Array ? state : new Uint8Array(state)) : null,
        sramB64: sram ? b64FromU8(sram) : null,
      };
    });
  }

  function exportWithRetries(done, attempt) {
    var idx = attempt || 0;
    var delay = EXPORT_DELAYS_MS[Math.min(idx, EXPORT_DELAYS_MS.length - 1)];
    window.setTimeout(function () {
      collectExportPayload()
        .then(function (payload) {
          if ((payload.stateB64 || payload.sramB64) || idx >= EXPORT_DELAYS_MS.length - 1) {
            done(payload);
            return;
          }
          exportWithRetries(done, idx + 1);
        })
        .catch(function (err) {
          if (idx >= EXPORT_DELAYS_MS.length - 1) {
            done({ ok: false, error: String(err && err.message ? err.message : err) });
            return;
          }
          exportWithRetries(done, idx + 1);
        });
    }, delay);
  }

  function reply(source, origin, reqId, payload) {
    if (!source) return;
    source.postMessage(
      Object.assign({ source: 'gametheca-emu', reqId: reqId }, payload),
      origin && origin !== 'null' ? origin : '*',
    );
  }

  // Expose for optional unit tests in Node (not used by emulator runtime).
  if (typeof window !== 'undefined') {
    window.__gtBridgeTest = { pickSramBytes: pickSramBytes };
  }

  window.addEventListener('message', function (ev) {
    var data = ev.data;
    if (!data || data.source !== 'gametheca') return;
    var type = data.type;
    var reqId = data.reqId;
    var origin = ev.origin;

    function done(payload) {
      reply(ev.source, origin, reqId, payload);
    }

    try {
      if (type === 'gt-ping') {
        done({
          ok: true,
          ready: typeof romName !== 'undefined' && !!romName,
          romName: typeof romName !== 'undefined' ? romName : null,
          mainCompleted: typeof mainCompleted !== 'undefined' ? !!mainCompleted : false,
        });
        return;
      }

      if (type === 'gt-export-saves') {
        if (typeof romName === 'undefined' || !romName) {
          done({ ok: false, error: 'ROM not ready yet' });
          return;
        }
        try {
          if (typeof Module !== 'undefined' && Module._cmd_save_state) Module._cmd_save_state();
        } catch (e1) {}
        try {
          if (typeof Module !== 'undefined' && Module._cmd_savefiles) Module._cmd_savefiles();
        } catch (e2) {}
        exportWithRetries(done, 0);
        return;
      }

      if (type === 'gt-import-saves') {
        if (typeof romName === 'undefined' || !romName) {
          done({ ok: false, error: 'ROM not ready yet' });
          return;
        }
        var stateBytes = u8FromB64(data.stateB64);
        var sramBytes = u8FromB64(data.sramB64);
        var imported = [];
        var autoLoaded = false;
        if (stateBytes) {
          if (typeof setIdbItem === 'function') {
            setIdbItem('RetroArch_states_' + romName, stateBytes);
          }
          if (typeof FS !== 'undefined') {
            try {
              FS.writeFile('/home/web_user/retroarch/userdata/states/rom.state', stateBytes);
              imported.push('state');
              autoLoaded = tryLoadState();
            } catch (e3) {
              imported.push('state-idb');
            }
          } else {
            imported.push('state-idb');
          }
        }
        if (sramBytes && typeof setIdbItem === 'function') {
          setIdbItem('RetroArch_saves_' + romName, [
            { ext: '.srm', dir: '', data: sramBytes },
          ]);
          imported.push('sram');
        }
        done({
          ok: true,
          imported: imported,
          autoLoaded: autoLoaded,
          hint: autoLoaded
            ? null
            : imported.indexOf('state') >= 0
              ? 'Press Load State in RetroArch menu if play did not resume'
              : null,
        });
        return;
      }

      if (type === 'gt-apply-cht') {
        if (typeof FS === 'undefined') {
          done({ ok: false, error: 'Emulator FS not ready' });
          return;
        }
        var text = data.text || '';
        if (!text) {
          done({ ok: false, error: 'Empty cheat file' });
          return;
        }
        var base = (typeof romName !== 'undefined' && romName)
          ? romName
          : String(data.name || 'cheat').replace(/[^\w.-]+/g, '_');
        var dir = '/home/web_user/retroarch/userdata/cheats';
        try {
          if (typeof FS.mkdirTree === 'function') FS.mkdirTree(dir);
          else FS.mkdir(dir);
        } catch (e4) {}
        var path = dir + '/' + base + '.cht';
        FS.writeFile(path, text);
        done({
          ok: true,
          path: path,
          hint: 'Quick Menu → Cheats → Load Cheat File (or Enable) if the core does not auto-load',
        });
        return;
      }

      done({ ok: false, error: 'Unknown message type' });
    } catch (err) {
      done({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  });
})();
