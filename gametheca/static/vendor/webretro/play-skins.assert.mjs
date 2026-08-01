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

// Distinct wallpaper cues for spot-check platforms
assert(css.includes('wood panel') || css.includes('NINTENDO ENTERTAINMENT SYSTEM'), 'NES room cue');
assert(css.includes('Super Nintendo'), 'SNES room cue');
assert(css.includes('PlayStation'), 'PSX room cue');
assert(css.includes('GAME BOY'), 'GB room cue');

console.log('play-skins.assert: OK (' + cases.length + ' platforms + motion/aspect/html)');
