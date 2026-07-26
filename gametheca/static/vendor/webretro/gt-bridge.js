/**
 * GameTheca ↔ WebRetro postMessage bridge (Wave 12).
 * Loaded after assets/base.js so romName / getIdbItem / FS / Module are in scope.
 */
(function () {
  'use strict';

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

  function pickSramBytes(saveArr) {
    if (!saveArr || !saveArr.length) return null;
    var preferred = null;
    for (var i = 0; i < saveArr.length; i++) {
      var entry = saveArr[i];
      var ext = (entry && entry.ext) || '';
      if (/\.srm$/i.test(ext) || ext.toLowerCase() === '.srm') {
        preferred = entry.data;
        break;
      }
      if (!preferred && entry && entry.data) preferred = entry.data;
    }
    return preferred ? (preferred instanceof Uint8Array ? preferred : new Uint8Array(preferred)) : null;
  }

  function reply(source, origin, reqId, payload) {
    if (!source) return;
    source.postMessage(
      Object.assign({ source: 'gametheca-emu', reqId: reqId }, payload),
      origin && origin !== 'null' ? origin : '*',
    );
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

        window.setTimeout(function () {
          Promise.resolve()
            .then(function () {
              var stateP = typeof getIdbItem === 'function'
                ? getIdbItem('RetroArch_states_' + romName)
                : Promise.resolve(null);
              var saveP = typeof getIdbItem === 'function'
                ? getIdbItem('RetroArch_saves_' + romName)
                : Promise.resolve(null);
              return Promise.all([stateP, saveP]);
            })
            .then(function (pair) {
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
              done({
                ok: true,
                romName: romName,
                stateB64: state ? b64FromU8(state instanceof Uint8Array ? state : new Uint8Array(state)) : null,
                sramB64: sram ? b64FromU8(sram) : null,
              });
            })
            .catch(function (err) {
              done({ ok: false, error: String(err && err.message ? err.message : err) });
            });
        }, 250);
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
        if (stateBytes) {
          if (typeof setIdbItem === 'function') {
            setIdbItem('RetroArch_states_' + romName, stateBytes);
          }
          if (typeof FS !== 'undefined') {
            try {
              FS.writeFile('/home/web_user/retroarch/userdata/states/rom.state', stateBytes);
              imported.push('state');
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
          hint: imported.indexOf('state') >= 0 ? 'Press Load State in RetroArch menu' : null,
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
