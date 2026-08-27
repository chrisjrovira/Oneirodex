/**
 * Emulator play-shell skins — mirrors member-app platformSkins families
 * so WebRetro pages can style without the React bundle.
 */
(function (global) {
  'use strict';

  var NINTENDO = {
    NES: 1, SNES: 1, NGC: 1, N64: 1, GB: 1, GBA: 1, GBC: 1, NDS: 1, VB: 1,
    WII: 1, N3DS: 1, SWITCH: 1,
  };
  var SONY = { PSX: 1, PS2: 1, PS3: 1, PS4: 1, PS5: 1, PSP: 1, PSVITA: 1 };
  var XBOX = { XBOX: 1, X360: 1, XONE: 1, XSX: 1 };
  var SEGA = {
    SEGA_MD: 1, SEGA_MS: 1, SEGA_CD: 1, SEGA_32X: 1, SEGA_GG: 1, SEGA_SATURN: 1,
    SEGA_DC: 1, SEGA_SG1000: 1,
  };
  var ARCADE = {
    ARCADE: 1, MAME: 1, FBNEO: 1, NEOGEO: 1, DAPHNE: 1, PINBALL: 1, ACTIONMAX: 1,
  };
  var ATARI = {
    ATARI_7800: 1, ATARI_5200: 1, ATARI_2600: 1, LYNX: 1, JAGUAR: 1,
    PCE: 1, PCFX: 1, NGP: 1, NGPC: 1, WS: 1, COLECO: 1, THREEDO: 1, VECTREX: 1,
    NEOGEO_CD: 1, INTV: 1, CHAF: 1, O2EM: 1, SUPERGRAFX: 1, PCE_CD: 1,
    SUPERVISION: 1, GX4000: 1, ASTROCADE: 1, ARCADIA: 1, CREATIVISION: 1,
    ADVISION: 1, STUDIO2: 1,
  };
  var PC = {
    PCWIN: 1, PCDOS: 1, PC: 1, MAC: 1, OTHER: 1, AMIGA: 1,
    VICE_X64SC: 1, VICE_X128: 1, VICE_XVIC: 1, VICE_XPLUS4: 1, VICE_XPET: 1,
  };

  var FAMILY_META = {
    nintendo: { family: 'nintendo', accent: '#e60012', label: 'Nintendo' },
    sony: { family: 'sony', accent: '#0070d1', label: 'Sony' },
    xbox: { family: 'xbox', accent: '#2fd67b', label: 'Xbox' },
    sega: { family: 'sega', accent: '#1a66ff', label: 'Sega' },
    arcade: { family: 'arcade', accent: '#ffcc00', label: 'Arcade' },
    atari: { family: 'atari', accent: '#f5a623', label: 'Retro' },
    pc: { family: 'pc', accent: '#2fd67b', label: 'PC' },
  };

  var PLATFORM_LABELS = {
    NES: 'NES',
    SNES: 'Super NES',
    N64: 'Nintendo 64',
    NGC: 'GameCube',
    GB: 'Game Boy',
    GBC: 'Game Boy Color',
    GBA: 'Game Boy Advance',
    NDS: 'Nintendo DS',
    VB: 'Virtual Boy',
    WII: 'Wii',
    N3DS: 'Nintendo 3DS',
    SWITCH: 'Nintendo Switch',
    PSX: 'PlayStation',
    PS2: 'PlayStation 2',
    PS3: 'PlayStation 3',
    PS4: 'PlayStation 4',
    PS5: 'PlayStation 5',
    PSP: 'PSP',
    PSVITA: 'PS Vita',
    SEGA_MD: 'Genesis / Mega Drive',
    SEGA_MS: 'Master System',
    SEGA_CD: 'Sega CD',
    SEGA_32X: '32X',
    SEGA_GG: 'Game Gear',
    SEGA_SATURN: 'Sega Saturn',
    SEGA_DC: 'Dreamcast',
    SEGA_SG1000: 'SG-1000',
    ARCADE: 'Arcade',
    MAME: 'Arcade',
    FBNEO: 'Arcade',
    ATARI_2600: 'Atari 2600',
    ATARI_5200: 'Atari 5200',
    ATARI_7800: 'Atari 7800',
    LYNX: 'Atari Lynx',
    JAGUAR: 'Atari Jaguar',
    THREEDO: '3DO',
    NEOGEO: 'Neo Geo AES',
    NEOGEO_CD: 'Neo Geo CD',
    NGP: 'Neo Geo Pocket',
    NGPC: 'Neo Geo Pocket Color',
    WS: 'WonderSwan',
    COLECO: 'ColecoVision',
    VECTREX: 'Vectrex',
    INTV: 'Intellivision',
    O2EM: 'Odyssey²',
    CHAF: 'Channel F',
    PCE: 'PC Engine',
    PCFX: 'PC-FX',
    SUPERGRAFX: 'SuperGrafx',
    PCE_CD: 'PC Engine CD',
    PCWIN: 'PC',
    PCDOS: 'DOS',
    PC: 'PC',
    MAC: 'Mac',
    OTHER: 'Other',
    AMIGA: 'Amiga',
    VICE_X64SC: 'Commodore 64',
    VICE_X128: 'Commodore 128',
    VICE_XVIC: 'VIC-20',
    VICE_XPLUS4: 'Plus/4',
    VICE_XPET: 'PET',
    XBOX: 'Xbox',
    X360: 'Xbox 360',
    XONE: 'Xbox One',
    XSX: 'Xbox Series',
    SUPERVISION: 'Supervision',
    GX4000: 'GX4000',
    ASTROCADE: 'Astrocade',
    ARCADIA: 'Arcadia 2001',
    CREATIVISION: 'CreatiVision',
    ADVISION: 'Adventure Vision',
    STUDIO2: 'Studio II',
    ACTIONMAX: 'Action Max',
    DAPHNE: 'Daphne',
    PINBALL: 'Pinball',
  };

  /**
   * Native system aspect ratio [w, h] — locks the play-shell screen box so
   * the emulator doesn't leave big empty black bars inside the bezel.
   * Handhelds (GB/GBA/NDS/etc.) already get a narrow --gt-play-bezel-max
   * from play-skins.css; this locks the screen itself to the real shape.
   */
  var ASPECT_RATIOS = {
    NES: [4, 3], SNES: [4, 3], N64: [4, 3], NGC: [4, 3], WII: [4, 3], N3DS: [5, 3],
    SWITCH: [16, 9],
    // NDS cores render both screens stacked into one portrait framebuffer.
    GB: [10, 9], GBC: [10, 9], GBA: [3, 2], NDS: [2, 3], VB: [4, 3],
    PSX: [4, 3], PS2: [4, 3], PS3: [16, 9], PS4: [16, 9], PS5: [16, 9],
    PSP: [16, 9], PSVITA: [16, 9],
    SEGA_MD: [4, 3], SEGA_MS: [4, 3], SEGA_CD: [4, 3], SEGA_32X: [4, 3],
    SEGA_GG: [10, 9], SEGA_SATURN: [4, 3], SEGA_DC: [4, 3], SEGA_SG1000: [4, 3],
    ARCADE: [4, 3], MAME: [4, 3], FBNEO: [4, 3], DAPHNE: [4, 3], PINBALL: [4, 3],
    ACTIONMAX: [4, 3],
    ATARI_2600: [4, 3], ATARI_5200: [4, 3], ATARI_7800: [4, 3],
    LYNX: [8, 5], JAGUAR: [4, 3], PCE: [4, 3], PCFX: [4, 3], SUPERGRAFX: [4, 3],
    PCE_CD: [4, 3],
    NGP: [10, 9], NGPC: [10, 9], WS: [10, 9], COLECO: [4, 3], THREEDO: [4, 3],
    VECTREX: [4, 3], NEOGEO: [4, 3], NEOGEO_CD: [4, 3], INTV: [4, 3], O2EM: [4, 3],
    CHAF: [4, 3], SUPERVISION: [10, 9], GX4000: [4, 3], ASTROCADE: [4, 3],
    ARCADIA: [4, 3], CREATIVISION: [4, 3], ADVISION: [4, 3], STUDIO2: [4, 3],
    XBOX: [4, 3], X360: [16, 9], XONE: [16, 9], XSX: [16, 9],
    PCWIN: [4, 3], PCDOS: [4, 3], PC: [4, 3], MAC: [4, 3], OTHER: [4, 3],
    AMIGA: [4, 3], VICE_X64SC: [4, 3], VICE_X128: [4, 3], VICE_XVIC: [4, 3],
    VICE_XPLUS4: [4, 3], VICE_XPET: [4, 3],
  };
  var DEFAULT_ASPECT = [4, 3];

  function aspectForPlatform(platformId) {
    var id = String(platformId || '').toUpperCase();
    return ASPECT_RATIOS[id] || DEFAULT_ASPECT;
  }

  /** Best-effort core → platform when URL omits platform=. */
  var CORE_TO_PLATFORM = {
    nestopia: 'NES',
    snes9x: 'SNES',
    mupen64plus_next: 'N64',
    parallel_n64: 'N64',
    mgba: 'GBA',
    gambatte: 'GB',
    melonds: 'NDS',
    mednafen_psx_hw: 'PSX',
    mednafen_psx: 'PSX',
    pcsx_rearmed: 'PSX',
    ppsspp: 'PSP',
    genesis_plus_gx: 'SEGA_MD',
    picodrive: 'SEGA_MD',
    gearsystem: 'SEGA_SG1000',
    yabause: 'SEGA_SATURN',
    flycast: 'SEGA_DC',
    mame: 'ARCADE',
    mame2003_plus: 'ARCADE',
    fbneo: 'ARCADE',
    stella2014: 'ATARI_2600',
    a5200: 'ATARI_5200',
    prosystem: 'ATARI_7800',
    handy: 'LYNX',
    virtualjaguar: 'JAGUAR',
    opera: 'THREEDO',
    neocd: 'NEOGEO_CD',
    mednafen_ngp: 'NGP',
    mednafen_vb: 'VB',
    mednafen_wswan: 'WS',
    gearcoleco: 'COLECO',
    vecx: 'VECTREX',
    o2em: 'O2EM',
    freeintv: 'INTV',
    freechaf: 'CHAF',
    dosbox_pure: 'PCDOS',
    vice_x64: 'VICE_X64SC',
    mednafen_pce_fast: 'PCE',
    mednafen_pce: 'PCE',
    mednafen_supergrafx: 'SUPERGRAFX',
    puae: 'AMIGA',
    potator: 'SUPERVISION',
    cap32: 'GX4000',
    dolphin: 'NGC',
    citra: 'N3DS',
    pcsx2: 'PS2',
  };

  function familyForPlatform(platformId) {
    var id = String(platformId || '').toUpperCase();
    if (!id) return 'pc';
    if (NINTENDO[id]) return 'nintendo';
    if (SONY[id]) return 'sony';
    if (XBOX[id]) return 'xbox';
    if (SEGA[id]) return 'sega';
    if (ARCADE[id]) return 'arcade';
    if (ATARI[id]) return 'atari';
    if (PC[id]) return 'pc';
    return 'pc';
  }

  function resolvePlatform(platformId, coreId) {
    var platform = String(platformId || '').toUpperCase();
    if (platform) return platform;
    var core = String(coreId || '').toLowerCase();
    return CORE_TO_PLATFORM[core] || '';
  }


  // ---- Room ambience (FEAT-D5) ----------------------------------------
  // The scanline overlay in play-skins.css (#webretro::after) is gated on
  // --gt-play-scanline-opacity, which defaults to 0. Nothing ever set it, so
  // the effect shipped invisible. This wires it to the room.
  //
  // Mirrors gametheca/utils/play_rooms.py (source of truth) and the member-app
  // copy in chrome/playRooms.js. Duplicated rather than imported because this
  // file is vendored, loads standalone in the player frame, and has no bundler.
  // Regenerate from the Python map rather than hand-editing.
  var ROOM_PLATFORMS = {
    wood_den_80s: 'ARCADIA ASTROCADE ATARI_2600 ATARI_5200 ATARI_7800 CHAF COLECO CREATIVISION GX4000 INTV NES O2EM PCE SEGA_MS SEGA_SG1000 STUDIO2 SUPERGRAFX VECTREX',
    teen_bedroom_90s: 'ADVISION GB GBC LYNX NGP NGPC SEGA_32X SEGA_GG SEGA_MD SNES SUPERVISION VB WS',
    carpet_den_late_90s: 'JAGUAR N64 PCE_CD PCFX PSX SEGA_CD SEGA_SATURN THREEDO',
    media_center_00s: 'GBA N3DS NDS NGC PS2 PS3 PSP PSVITA SEGA_DC SWITCH WII X360 XBOX XONE XSX',
    arcade_cabinet: 'ARCADE DAPHNE NEOGEO NEOGEO_CD PINBALL ACTIONMAX',
    desk: 'AMIGA MAC OTHER PCDOS PCWIN VICE_X128 VICE_X64SC VICE_XPET VICE_XPLUS4 VICE_XVIC'
  };

  // LCD / handheld panels never had CRT scanlines — even when the room is a
  // 1990s bedroom. Getting that wrong is what makes fake-CRT filters look
  // like a gimmick.
  var LCD_PLATFORMS = {
    GB: 1, GBC: 1, GBA: 1, NDS: 1, N3DS: 1, PSP: 1, PSVITA: 1,
    LYNX: 1, NGP: 1, NGPC: 1, WS: 1, SUPERVISION: 1, ADVISION: 1, SEGA_GG: 1
  };

  // Scanlines follow the *display*, with a room fallback for CRT sets:
  // strongest on an 80s tube, still present late-90s, faint on 00s sets.
  var SCANLINE_BY_ROOM = {
    wood_den_80s: 0.55,
    teen_bedroom_90s: 0.48,
    carpet_den_late_90s: 0.32,
    media_center_00s: 0.14,
    arcade_cabinet: 0.4,
    desk: 0.28
  };

  var PICTURE_MODES = ['crt', 'sharp', 'soft'];
  var PICTURE_LABELS = { crt: 'CRT', sharp: 'Sharp', soft: 'Soft' };
  var STORAGE_PICTURE = 'gt-play-picture';

  function isLcdPlatform(platformId) {
    var id = String(platformId || '').trim().toUpperCase();
    return !!LCD_PLATFORMS[id];
  }

  function defaultPictureForRoom(room) {
    if (room === 'desk') return 'sharp';
    return 'crt';
  }

  function defaultPictureForPlatform(platformId, room) {
    if (isLcdPlatform(platformId)) return 'sharp';
    return defaultPictureForRoom(room);
  }

  function scanlineFor(platformId, room) {
    if (isLcdPlatform(platformId)) return 0;
    var scan = SCANLINE_BY_ROOM[room];
    return scan === undefined ? 0 : scan;
  }

  function readStoredPicture() {
    try {
      if (typeof localStorage === 'undefined') return '';
      var stored = localStorage.getItem(STORAGE_PICTURE);
      if (stored === 'crt' || stored === 'sharp' || stored === 'soft') return stored;
    } catch (e) {}
    return '';
  }

  function applyPictureMode(mode) {
    var body = typeof document !== 'undefined' ? document.body : null;
    var root = typeof document !== 'undefined' ? document.documentElement : null;
    var room = (body && body.getAttribute('data-play-room')) || 'wood_den_80s';
    var platform = (body && body.getAttribute('data-platform')) || '';
    var next = (mode === 'crt' || mode === 'sharp' || mode === 'soft')
      ? mode
      : (readStoredPicture() || defaultPictureForPlatform(platform, room));
    if (root) {
      root.setAttribute('data-picture', next);
      if (body) body.setAttribute('data-picture', next);
      if (next === 'crt') {
        root.style.setProperty(
          '--gt-play-scanline-opacity',
          String(scanlineFor(platform, room))
        );
      } else {
        root.style.setProperty('--gt-play-scanline-opacity', '0');
      }
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_PICTURE, next);
    } catch (e2) {}
    return next;
  }

  function cyclePictureMode(current) {
    var idx = PICTURE_MODES.indexOf(current);
    var next = PICTURE_MODES[(idx + 1) % PICTURE_MODES.length];
    return applyPictureMode(next);
  }

  var ROOM_BY_PLATFORM = (function () {
    var out = {};
    for (var room in ROOM_PLATFORMS) {
      if (!Object.prototype.hasOwnProperty.call(ROOM_PLATFORMS, room)) continue;
      var list = ROOM_PLATFORMS[room].split(' ');
      for (var i = 0; i < list.length; i++) {
        if (list[i]) out[list[i]] = room;
      }
    }
    return out;
  })();

  function roomForPlatform(platformId) {
    var key = String(platformId || '').trim().toUpperCase();
    return ROOM_BY_PLATFORM[key] || 'wood_den_80s';
  }

  function applyPlaySkin(platformId, coreId) {
    var platform = resolvePlatform(platformId, coreId);
    var family = familyForPlatform(platform || 'pc');
    var meta = FAMILY_META[family] || FAMILY_META.pc;
    var root = document.documentElement;
    var body = document.body;

    if (platform) {
      root.setAttribute('data-platform', platform);
      body.setAttribute('data-platform', platform);
    } else {
      root.removeAttribute('data-platform');
      body.removeAttribute('data-platform');
    }
    root.setAttribute('data-platform-family', family);
    body.setAttribute('data-platform-family', family);
    // Family accent is a fallback only — per-platform CSS owns the room look.
    root.style.setProperty('--gt-play-accent', meta.accent);
    root.style.setProperty('--gt-platform-accent', meta.accent);

    var room = roomForPlatform(platform || 'pc');
    root.setAttribute('data-play-room', room);
    body.setAttribute('data-play-room', room);
    root.style.setProperty(
      '--gt-play-scanline-opacity',
      String(scanlineFor(platform, room))
    );

    var picture = applyPictureMode();

    var aspect = aspectForPlatform(platform || 'pc');
    var aspectCss = aspect[0] + ' / ' + aspect[1];
    root.style.setProperty('--gt-play-aspect', aspectCss);
    body.style.setProperty('--gt-play-aspect', aspectCss);

    return {
      platform: platform,
      family: family,
      accent: meta.accent,
      familyLabel: meta.label,
      systemLabel: PLATFORM_LABELS[platform] || platform || meta.label,
      aspectRatio: aspect,
      picture: picture,
      room: room,
    };
  }

  global.GameThecaPlaySkins = {
    familyForPlatform: familyForPlatform,
    resolvePlatform: resolvePlatform,
    applyPlaySkin: applyPlaySkin,
    aspectForPlatform: aspectForPlatform,
    PLATFORM_LABELS: PLATFORM_LABELS,
    CORE_TO_PLATFORM: CORE_TO_PLATFORM,
    ASPECT_RATIOS: ASPECT_RATIOS,
    roomForPlatform: roomForPlatform,
    SCANLINE_BY_ROOM: SCANLINE_BY_ROOM,
    LCD_PLATFORMS: LCD_PLATFORMS,
    PICTURE_MODES: PICTURE_MODES,
    PICTURE_LABELS: PICTURE_LABELS,
    isLcdPlatform: isLcdPlatform,
    scanlineFor: scanlineFor,
    defaultPictureForRoom: defaultPictureForRoom,
    defaultPictureForPlatform: defaultPictureForPlatform,
    applyPictureMode: applyPictureMode,
    cyclePictureMode: cyclePictureMode,
  };
})(typeof window !== 'undefined' ? window : this);
