/**
 * W20-7 unmatched triage heuristics — shared by admin_manage_scanjobs (+ vitest via alias).
 * Client-side only; no disk I/O.
 */

/** Basename of a folder_path (POSIX or Windows). */
export function folderBasename(path) {
  const parts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

const ROM_LEAF_EXT =
  /\.(nes|snes|smc|sfc|gb|gbc|gba|nds|3ds|cia|n64|z64|v64|md|gen|sms|gg|pce|ngp|gcm|wbfs|wad|ciso|pbp|rvz|nsp|xci|chd|iso|bin|cue|zip|7z|rar)$/i;

/**
 * Console scan leaves: ROM/archive file vs named game folder.
 * @returns {'file-leaf'|'folder-leaf'}
 */
export function detectLeafType(folderPath) {
  const base = folderBasename(folderPath);
  if (!base) return 'folder-leaf';
  return ROM_LEAF_EXT.test(base) ? 'file-leaf' : 'folder-leaf';
}

function normalizePlatformKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Folder segments often spell a platform that differs from library assignment. */
const PATH_PLATFORM_MARKERS = [
  { id: 'neo geo cd', patterns: ['neo geo cd', 'neogeocd', 'ngcd'] },
  { id: 'neo geo', patterns: ['neo geo', 'neogeo', 'neo-geo'] },
  { id: 'atari 2600', patterns: ['atari 2600', 'atari2600', 'a2600'] },
  { id: 'atari 5200', patterns: ['atari 5200', 'atari5200'] },
  { id: 'atari 7800', patterns: ['atari 7800', 'atari7800'] },
  { id: 'super nintendo', patterns: ['super nintendo', 'snes', 'super famicom'] },
  { id: 'nintendo entertainment system', patterns: ['nes', 'nintendo entertainment system'] },
  { id: 'nintendo 64', patterns: ['nintendo 64', 'n64'] },
  { id: 'game boy', patterns: ['game boy', 'gameboy', 'gb'] },
  { id: 'game boy advance', patterns: ['game boy advance', 'gba'] },
  { id: 'game boy color', patterns: ['game boy color', 'gbc'] },
  { id: 'playstation', patterns: ['playstation', 'ps1', 'psx'] },
  { id: 'playstation 2', patterns: ['playstation 2', 'ps2'] },
  { id: 'playstation 3', patterns: ['playstation 3', 'ps3'] },
  { id: 'playstation portable', patterns: ['psp', 'playstation portable'] },
  { id: 'sega genesis', patterns: ['sega genesis', 'mega drive', 'megadrive', 'genesis'] },
  { id: 'sega master system', patterns: ['master system', 'sms'] },
  { id: 'sega saturn', patterns: ['sega saturn', 'saturn'] },
  { id: 'dreamcast', patterns: ['dreamcast'] },
  { id: 'gamecube', patterns: ['gamecube', 'ngc'] },
  { id: 'wii', patterns: ['wii'] },
  { id: 'wii u', patterns: ['wii u', 'wiiu'] },
  { id: 'xbox', patterns: ['xbox'] },
  { id: 'xbox 360', patterns: ['xbox 360', 'xbox360'] },
  { id: 'mame', patterns: ['mame'] },
];

function platformsCompatible(assigned, hint) {
  const a = normalizePlatformKey(assigned);
  const h = normalizePlatformKey(hint);
  if (!a || !h) return true;
  if (a === h) return true;
  if (a.includes(h) || h.includes(a)) return true;
  return false;
}

function pathPlatformHints(folderPath) {
  const segments = String(folderPath || '')
    .replace(/\\/g, '/')
    .toLowerCase()
    .split('/')
    .filter(Boolean);
  const norm = segments.join('/');
  const compact = norm.replace(/[^a-z0-9]+/g, '');
  const hints = [];
  PATH_PLATFORM_MARKERS.forEach(({ id, patterns }) => {
    const hit = patterns.some((pat) => {
      const p = pat.toLowerCase();
      const pCompact = p.replace(/[^a-z0-9]+/g, '');
      if (p.length <= 3) {
        return segments.some((seg) => {
          const segCompact = seg.replace(/[^a-z0-9]+/g, '');
          return segCompact === pCompact || seg === p;
        });
      }
      return norm.includes(p) || compact.includes(pCompact);
    });
    if (hit) hints.push(id);
  });
  return hints;
}

/**
 * Heuristic: path embeds a platform folder name that disagrees with assigned platform/library.
 * @returns {{ pathHint: string, assignedPlatform: string, libraryName: string } | null}
 */
export function detectPlatformMismatch(folderPath, libraryName, platformName) {
  const assigned = normalizePlatformKey(platformName);
  const libraryKey = normalizePlatformKey(libraryName);
  const hints = pathPlatformHints(folderPath);
  if (!hints.length) return null;

  const conflicting = hints.find(
    (hint) => !platformsCompatible(assigned, hint) && !platformsCompatible(libraryKey, hint),
  );
  if (!conflicting) return null;

  return {
    pathHint: conflicting,
    assignedPlatform: String(platformName || '').trim() || '(unknown)',
    libraryName: String(libraryName || '').trim() || '(unknown)',
  };
}

const GARBAGE_PATTERNS = [
  /(^|\/)(temp|tmp|cache|\.trash|recycle|backup|old|unused|misc|random)(\/|$)/i,
  /desktop\.ini|thumbs\.db|\.ds_store/i,
  /(screenshot|wallpaper|theme pack|soundtrack only|ost only)/i,
  /(redist|vcredist|directx|dotnet|prerequisites|_commonredist|__installer)/i,
  /(^|\/)(update|patch|dlc|modpack|mod pack)(\/|$)/i,
  /(bios|firmware|system)\.(zip|7z|bin)$/i,
];

/**
 * Likely non-game scaffolding (installers, redistributables, temp trees).
 */
export function isGarbageScaffolding(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.status === 'Ignore') return false;

  const path = row.folder_path || row.path || '';
  const name = row.folder_name || folderBasename(path);
  const kind = row.suggested_kind == null ? '' : String(row.suggested_kind).trim().toLowerCase();
  const combined = [
    path,
    name,
    row.library_name,
    row.platform_name,
    row.why_unmatched,
    row.unmatched_reason,
    row.match_reason,
    row.suggested_candidate_name,
  ]
    .filter(Boolean)
    .join(' ');

  if (GARBAGE_PATTERNS.some((pat) => pat.test(combined))) return true;

  if (kind === 'tool' && /(bios|firmware|redist|installer|prerequisite|utility)/i.test(combined)) {
    return true;
  }

  return false;
}

/** Human label for platform mismatch badge title. */
export function formatPlatformMismatchTitle(mismatch) {
  if (!mismatch) return '';
  const hint = mismatch.pathHint.replace(/\b\w/g, (c) => c.toUpperCase());
  return `Path suggests ${hint}; library is ${mismatch.libraryName} (${mismatch.assignedPlatform}). Review assignment.`;
}
