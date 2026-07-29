/**
 * Emulator play-shell skins — mirrors member-app platformSkins families
 * so WebRetro pages can style without the React bundle.
 */
(function (global) {
  'use strict';

  var NINTENDO = {
    NES: 1, SNES: 1, NGC: 1, N64: 1, GB: 1, GBA: 1, GBC: 1, NDS: 1, VB: 1,
    WII: 1, N3DS: 1,
  };
  var SONY = { PSX: 1, PS2: 1, PS3: 1, PS4: 1, PS5: 1, PSP: 1, PSVITA: 1 };
  var XBOX = { XBOX: 1, X360: 1, XONE: 1, XSX: 1 };
  var SEGA = {
    SEGA_MD: 1, SEGA_MS: 1, SEGA_CD: 1, SEGA_32X: 1, SEGA_GG: 1, SEGA_SATURN: 1,
    SEGA_DC: 1,
  };
  var ARCADE = { ARCADE: 1, MAME: 1, FBNEO: 1 };
  var ATARI = {
    ATARI_7800: 1, ATARI_5200: 1, ATARI_2600: 1, LYNX: 1, JAGUAR: 1,
    PCE: 1, PCFX: 1, NGP: 1, WS: 1, COLECO: 1, THREEDO: 1, VECTREX: 1,
    NEOGEO_CD: 1, INTV: 1, CHAF: 1, O2EM: 1,
  };
  var PC = { PCWIN: 1, PCDOS: 1, PC: 1, MAC: 1, OTHER: 1 };

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
    PSX: 'PlayStation',
    PS2: 'PlayStation 2',
    PSP: 'PSP',
    PSVITA: 'PS Vita',
    SEGA_MD: 'Genesis / Mega Drive',
    SEGA_MS: 'Master System',
    SEGA_CD: 'Sega CD',
    SEGA_32X: '32X',
    SEGA_GG: 'Game Gear',
    SEGA_SATURN: 'Sega Saturn',
    SEGA_DC: 'Dreamcast',
    ARCADE: 'Arcade',
    MAME: 'Arcade',
    FBNEO: 'Arcade',
    ATARI_2600: 'Atari 2600',
    ATARI_5200: 'Atari 5200',
    ATARI_7800: 'Atari 7800',
    LYNX: 'Atari Lynx',
    JAGUAR: 'Atari Jaguar',
    THREEDO: '3DO',
    NEOGEO_CD: 'Neo Geo CD',
    NGP: 'Neo Geo Pocket',
    WS: 'WonderSwan',
    COLECO: 'ColecoVision',
    VECTREX: 'Vectrex',
    INTV: 'Intellivision',
    O2EM: 'Odyssey²',
    CHAF: 'Channel F',
    PCWIN: 'PC',
    PCDOS: 'DOS',
    PC: 'PC',
    MAC: 'Mac',
  };

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

    return {
      platform: platform,
      family: family,
      accent: meta.accent,
      familyLabel: meta.label,
      systemLabel: PLATFORM_LABELS[platform] || platform || meta.label,
    };
  }

  global.GameThecaPlaySkins = {
    familyForPlatform: familyForPlatform,
    resolvePlatform: resolvePlatform,
    applyPlaySkin: applyPlaySkin,
    PLATFORM_LABELS: PLATFORM_LABELS,
    CORE_TO_PLATFORM: CORE_TO_PLATFORM,
  };
})(typeof window !== 'undefined' ? window : this);
