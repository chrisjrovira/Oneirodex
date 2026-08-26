/**
 * Lightweight assert for play-skins.js (no vitest/browser).
 * Run: node gametheca/static/vendor/webretro/play-skins.assert.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'play-skins.js'), 'utf8');
const css = readFileSync(join(__dirname, 'play-skins.css'), 'utf8');
const html = readFileSync(join(__dirname, 'webretro.html'), 'utf8');
const bridge = readFileSync(join(__dirname, 'gt-bridge.js'), 'utf8');

const sandbox = { window: {}, console };
vm.runInNewContext(src, sandbox);
const skins = sandbox.window.GameThecaPlaySkins;
if (!skins) throw new Error('GameThecaPlaySkins missing');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cases = [
  { platform: 'SNES', family: 'nintendo', aspect: [4, 3], label: 'Super NES' },
  { platform: 'PSX', family: 'sony', aspect: [4, 3], label: 'PlayStation' },
  { platform: 'GB', family: 'nintendo', aspect: [10, 9], label: 'Game Boy' },
  { platform: 'SEGA_MD', family: 'sega', aspect: [4, 3], label: 'Genesis / Mega Drive' },
  { platform: 'ARCADE', family: 'arcade', aspect: [4, 3], label: 'Arcade' },
  { platform: 'PCWIN', family: 'pc', aspect: [4, 3], label: 'PC' },
];

for (const c of cases) {
  assert(skins.familyForPlatform(c.platform) === c.family, `${c.platform} family`);
  const aspect = skins.aspectForPlatform(c.platform);
  assert(aspect[0] === c.aspect[0] && aspect[1] === c.aspect[1], `${c.platform} aspect`);
  assert(skins.PLATFORM_LABELS[c.platform] === c.label, `${c.platform} label`);
  assert(css.includes(`[data-platform="${c.platform}"]`) || css.includes(`[data-platform="${c.platform}"],`), `${c.platform} CSS room`);
}

assert(skins.resolvePlatform('', 'snes9x') === 'SNES', 'core→platform snes9x');
assert(skins.resolvePlatform('', 'mednafen_psx_hw') === 'PSX', 'core→platform psx');
assert(skins.resolvePlatform('', 'gambatte') === 'GB', 'core→platform gambatte');

assert(css.includes('#gt-play-atmosphere'), 'atmosphere stack');
assert(css.includes('gt-play-wall-drift'), 'wall drift motion');
assert(css.includes('gt-play-lamp-breathe'), 'lamp breathe motion');
assert(css.includes('gt-play-specular'), 'bezel specular motion');
assert(css.includes('aspect-ratio: var(--gt-play-aspect'), 'aspect-lock intact');
assert(css.includes('prefers-reduced-motion'), 'reduced-motion gate');
assert(html.includes('gt-play-atmosphere'), 'html atmosphere');
assert(html.includes('gt-play-bar-identity'), 'html bar identity');
assert(html.includes('gt-play-bezel-mat'), 'html bezel mat');
assert(html.includes('← Library'), 'library back button');
assert(html.includes('data-gt-play="pause"'), 'pause control');
assert(html.includes('data-gt-play="reset"'), 'reset control');
assert(html.includes('data-gt-play="mute"'), 'mute control');
assert(html.includes('data-gt-play="power"'), 'power control');
assert(html.includes('data-gt-play="save"'), 'save state control');
assert(html.includes('data-gt-play="load"'), 'load state control');
assert(html.includes('data-gt-play="rewind"'), 'rewind control');
assert(html.includes('data-gt-play="ff"'), 'fast-forward control');
assert(html.includes('data-gt-play="picture"'), 'picture control');
assert(html.includes('id="gt-play-help"'), 'shortcuts help');
assert(html.includes('id="gt-play-volume"'), 'volume slider');
assert(html.includes('gt-play-overlay'), 'in-game overlay');
assert(css.includes('.gt-play-overlay'), 'overlay CSS');
assert(css.includes('.gt-play-chrome'), 'bar chrome cluster');
assert(css.includes('[data-picture="crt"]'), 'CRT picture CSS');
assert(css.includes('[data-picture="sharp"]'), 'sharp picture CSS');
assert(css.includes('[data-picture="soft"]'), 'soft picture CSS');
assert(css.includes('.gt-play-help'), 'shortcuts dialog CSS');

// Distinct wallpaper cues for spot-check platforms
assert(css.includes('wood panel') || css.includes('NINTENDO ENTERTAINMENT SYSTEM'), 'NES room cue');
assert(css.includes('Super Nintendo'), 'SNES room cue');
assert(css.includes('PlayStation'), 'PSX room cue');
assert(css.includes('GAME BOY'), 'GB room cue');

// --- Room ambience / scanline wiring (FEAT-D5) ---
// The overlay defaults to opacity 0 and used to ship that way forever because
// nothing set the variable. These pin the wiring so it cannot silently revert.
assert(css.includes('--gt-play-scanline-opacity'), 'scanline overlay var in CSS');
assert(src.includes('SCANLINE_BY_ROOM'), 'scanline table present');
assert(src.includes('--gt-play-scanline-opacity'), 'scanline var is actually set');

assert(typeof skins.roomForPlatform === 'function', 'roomForPlatform exported');
const roomCases = [
  ['SNES', 'crt_living_room'],
  ['SEGA_MD', 'crt_living_room'],
  ['ARCADE', 'arcade_cabinet'],
  ['NEOGEO', 'arcade_cabinet'],
  ['GB', 'handheld'],
  ['PSP', 'handheld'],
  ['PSX', 'disc_era'],
  ['SEGA_DC', 'disc_era'],
  ['PCWIN', 'desk'],
  ['VICE_X64SC', 'desk'],
];
for (const [platform, room] of roomCases) {
  assert(skins.roomForPlatform(platform) === room, `${platform} room → ${room}`);
}
assert(skins.roomForPlatform('NOT_A_PLATFORM') === 'crt_living_room', 'unknown platform falls back');

// Handhelds are LCD — scanlines there are the tell of a gimmick filter.
assert(skins.SCANLINE_BY_ROOM.handheld === 0, 'handheld has no scanlines');
assert(skins.SCANLINE_BY_ROOM.crt_living_room > skins.SCANLINE_BY_ROOM.disc_era,
  'CRT living room is stronger than late disc-era sets');

assert(bridge.includes("type === 'gt-pause'"), 'bridge pause');
assert(bridge.includes("type === 'gt-reset'"), 'bridge reset');
assert(bridge.includes("type === 'gt-audio'"), 'bridge audio');
assert(bridge.includes("type === 'gt-save-state'"), 'bridge save state');
assert(bridge.includes("type === 'gt-load-state'"), 'bridge load state');
assert(bridge.includes("type === 'gt-picture'"), 'bridge picture');
assert(bridge.includes("type === 'gt-cabinet-key'"), 'bridge cabinet keys');
assert(bridge.includes('audio_mute'), 'bridge writes audio_mute');
assert(bridge.includes('_cmd_reset'), 'bridge can call core reset');
assert(bridge.includes('_cmd_save_state'), 'bridge can call save state');
assert(typeof skins.defaultPictureForRoom === 'function', 'defaultPictureForRoom exported');
assert(skins.defaultPictureForRoom('handheld') === 'sharp', 'handheld picture defaults sharp (LCD)');
assert(skins.defaultPictureForRoom('desk') === 'sharp', 'desk picture defaults sharp');
assert(skins.defaultPictureForRoom('crt_living_room') === 'crt', 'CRT room picture defaults crt');
assert(skins.defaultPictureForRoom('arcade_cabinet') === 'crt', 'arcade picture defaults crt');
assert(skins.PICTURE_MODES.join(',') === 'crt,sharp,soft', 'picture cycle order');

console.log('play-skins.assert: OK (' + cases.length + ' platforms + motion/aspect/html)');
