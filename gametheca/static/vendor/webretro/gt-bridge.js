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

  function pauseButton() {
    return document.getElementById('pause');
  }

  function pauseLabel() {
    var el = pauseButton();
    return el ? String(el.textContent || '').trim() : '';
  }

  function isCorePaused() {
    if (typeof window !== 'undefined' && typeof window.isPaused === 'boolean') {
      return window.isPaused;
    }
    return pauseLabel() === 'Resume';
  }

  function applyPause(wantPaused) {
    var el = pauseButton();
    var paused = isCorePaused();
    if (typeof wantPaused === 'boolean' && wantPaused === paused) {
      return paused;
    }
    if (el && !el.classList.contains('disabled') && typeof el.click === 'function') {
      el.click();
      return isCorePaused();
    }
    try {
      if (typeof Module === 'undefined') return paused;
      if (wantPaused === false || (!wantPaused && paused)) {
        if (typeof Module.resumeMainLoop === 'function') Module.resumeMainLoop();
        if (typeof window !== 'undefined') window.isPaused = false;
        return false;
      }
      if (typeof Module.pauseMainLoop === 'function') Module.pauseMainLoop();
      if (typeof window !== 'undefined') window.isPaused = true;
      return true;
    } catch (e) {
      return paused;
    }
  }

  function volumeToDb(pct) {
    var n = Math.max(0, Math.min(100, Number(pct)));
    if (!Number.isFinite(n) || n <= 0) return -80;
    return Math.round(Math.log10(n / 100) * 20 * 10) / 10;
  }

  function stripAudioConfig(cfg) {
    return String(cfg || '')
      .replace(/audio_mute\s*=\s*"[^"]*"\n?/g, '')
      .replace(/audio_volume\s*=\s*"[^"]*"\n?/g, '');
  }

  var lastVolumePct = 100;
  var lastMuted = false;

  function applyAudio(opts) {
    opts = opts || {};
    var muted = typeof opts.muted === 'boolean' ? opts.muted : lastMuted;
    var volume = opts.volume;
    if (volume != null && volume !== '') {
      var parsed = Number(volume);
      if (Number.isFinite(parsed)) {
        lastVolumePct = Math.max(0, Math.min(100, parsed));
      }
    }
    if (lastVolumePct <= 0) muted = true;
    lastMuted = muted;
    var db = muted ? -80 : volumeToDb(lastVolumePct);
    if (typeof extraConfigExtras === 'string') {
      extraConfigExtras = stripAudioConfig(extraConfigExtras);
      extraConfigExtras += 'audio_mute = "' + (muted ? 'true' : 'false') + '"\n';
      extraConfigExtras += 'audio_volume = "' + db + '"\n';
    }
    try {
      if (typeof tryApplyConfig === 'function') tryApplyConfig();
    } catch (e) {}
    return { muted: lastMuted, volume: lastMuted ? 0 : lastVolumePct };
  }

  var lastPicture = 'crt';
  var lastFastForward = false;
  var lastRewindHeld = false;
  var lastRewindEnabled = true;

  /** Heavy cores stutter if rewind keeps a frame buffer on single-thread WASM. */
  var HEAVY_REWIND_CORES = {
    mupen64plus_next: 1,
    parallel_n64: 1,
    mednafen_psx_hw: 1,
    mednafen_psx: 1,
    pcsx_rearmed: 1,
    yabause: 1,
    yabasanshiro: 1,
    flycast: 1,
    ppsspp: 1,
  };

  function rewindOkForCore(id) {
    var c = String(id || '').toLowerCase();
    return !HEAVY_REWIND_CORES[c];
  }

  function applyRewindForCurrentCore() {
    var id = typeof core !== 'undefined' ? core : '';
    lastRewindEnabled = rewindOkForCore(id);
    if (typeof extraConfigExtras !== 'string') return lastRewindEnabled;
    extraConfigExtras = String(extraConfigExtras).replace(/rewind_enable\s*=\s*"[^"]*"\n?/g, '');
    if (!lastRewindEnabled) {
      extraConfigExtras += 'rewind_enable = "false"\n';
    }
    return lastRewindEnabled;
  }

  applyRewindForCurrentCore();

  function stripPictureConfig(cfg) {
    return String(cfg || '').replace(/video_smooth\s*=\s*"[^"]*"\n?/g, '');
  }

  function applyPicture(mode) {
    var next = mode === 'soft' || mode === 'sharp' || mode === 'crt' ? mode : 'crt';
    lastPicture = next;
    if (typeof extraConfigExtras === 'string') {
      extraConfigExtras = stripPictureConfig(extraConfigExtras);
      extraConfigExtras += 'video_smooth = "' + (next === 'soft' ? 'true' : 'false') + '"\n';
    }
    try {
      if (typeof tryApplyConfig === 'function') tryApplyConfig();
    } catch (e) {}
    try {
      var canvasEl = document.getElementById('canvas');
      if (canvasEl) {
        canvasEl.className = next === 'soft' ? 'textureSmooth' : 'texturePixelated';
      }
      var smoothEl = document.getElementById('smooth');
      if (smoothEl) smoothEl.checked = next === 'soft';
    } catch (e2) {}
    return lastPicture;
  }

  var CABINET_KEYS = {
    ShiftRight: { key: 'Shift', keyCode: 16 },
    Tab: { key: 'Tab', keyCode: 9 },
    F5: { key: 'F5', keyCode: 116 },
  };

  function dispatchCabinetKey(code, down) {
    var meta = CABINET_KEYS[code];
    if (!meta) return false;
    var type = down ? 'keydown' : 'keyup';
    var ev;
    try {
      ev = new KeyboardEvent(type, {
        key: meta.key,
        code: code,
        keyCode: meta.keyCode,
        which: meta.keyCode,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      try {
        Object.defineProperty(ev, 'keyCode', { get: function () { return meta.keyCode; } });
        Object.defineProperty(ev, 'which', { get: function () { return meta.keyCode; } });
      } catch (e) {}
    } catch (err) {
      return false;
    }
    window.dispatchEvent(ev);
    document.dispatchEvent(ev);
    var canvasEl = document.getElementById('canvas');
    if (canvasEl) canvasEl.dispatchEvent(ev);
    if (code === 'ShiftRight') lastRewindHeld = !!down;
    if (code === 'Tab' && down) lastFastForward = true;
    if (code === 'Tab' && !down) lastFastForward = false;
    return true;
  }

  function pulseCabinetKey(code) {
    dispatchCabinetKey(code, true);
    window.setTimeout(function () {
      dispatchCabinetKey(code, false);
    }, 40);
    if (code === 'F5') lastFastForward = !lastFastForward;
    return true;
  }

  function clickWebretroControl(id, fallback) {
    var el = document.getElementById(id);
    if (el && !el.classList.contains('disabled') && typeof el.click === 'function') {
      el.click();
      return true;
    }
    try {
      if (typeof Module !== 'undefined' && typeof fallback === 'function') {
        fallback();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function controlState() {
    return {
      paused: isCorePaused(),
      muted: lastMuted,
      volume: lastMuted ? 0 : lastVolumePct,
      picture: lastPicture,
      fastForward: lastFastForward,
      rewindHeld: lastRewindHeld,
      rewindEnabled: lastRewindEnabled,
    };
  }

  // Expose for optional unit tests in Node (not used by emulator runtime).
  if (typeof window !== 'undefined') {
    window.__gtBridgeTest = {
      pickSramBytes: pickSramBytes,
      volumeToDb: volumeToDb,
      rewindOkForCore: rewindOkForCore,
    };
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
          rewindEnabled: lastRewindEnabled,
          picture: lastPicture,
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

      if (type === 'gt-pause') {
        var paused = applyPause(typeof data.paused === 'boolean' ? data.paused : undefined);
        done(Object.assign({ ok: true }, controlState(), { paused: paused }));
        return;
      }

      if (type === 'gt-reset') {
        try {
          var resetEl = document.getElementById('resetbutton') || document.getElementById('resetbutton2');
          if (resetEl && !resetEl.classList.contains('disabled') && typeof resetEl.click === 'function') {
            resetEl.click();
          } else if (typeof Module !== 'undefined' && typeof Module._cmd_reset === 'function') {
            Module._cmd_reset();
          } else {
            done({ ok: false, error: 'Reset is not ready yet' });
            return;
          }
          done(Object.assign({ ok: true }, controlState()));
        } catch (resetErr) {
          done({ ok: false, error: String(resetErr && resetErr.message ? resetErr.message : resetErr) });
        }
        return;
      }

      if (type === 'gt-audio') {
        done(Object.assign({ ok: true }, applyAudio(data)));
        return;
      }

      if (type === 'gt-control-state') {
        done(Object.assign({ ok: true }, controlState()));
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

      if (type === 'gt-save-state') {
        var saved = clickWebretroControl('savestate', function () {
          Module._cmd_save_state();
        });
        if (!saved) {
          done({ ok: false, error: 'Save state is not ready yet' });
          return;
        }
        done(Object.assign({ ok: true }, controlState()));
        return;
      }

      if (type === 'gt-load-state') {
        var loaded = clickWebretroControl('loadstate', function () {
          Module._cmd_load_state();
        });
        if (!loaded) {
          done({ ok: false, error: 'Load state is not ready yet' });
          return;
        }
        done(Object.assign({ ok: true }, controlState()));
        return;
      }

      if (type === 'gt-picture') {
        done(Object.assign({ ok: true }, controlState(), { picture: applyPicture(data.mode) }));
        return;
      }

      if (type === 'gt-cabinet-key') {
        var code = String(data.code || '');
        if (!CABINET_KEYS[code]) {
          done({ ok: false, error: 'Unknown cabinet key' });
          return;
        }
        if (data.pulse) {
          pulseCabinetKey(code);
        } else {
          dispatchCabinetKey(code, !!data.down);
        }
        done(Object.assign({ ok: true }, controlState()));
        return;
      }

      done({ ok: false, error: 'Unknown message type' });
    } catch (err) {
      done({ ok: false, error: String(err && err.message ? err.message : err) });
    }
  });
})();
