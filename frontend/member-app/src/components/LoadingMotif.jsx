/**
 * Loading motifs — consoles and controllers from the systems Oneirodex supports
 * (GT-B23 · UID-008).
 *
 * The previous set was six abstract shapes: ring, orbit, pulse, blocks, scan,
 * arcade. They were animated, but the motion was a slow opacity/rotation drift
 * that read as a slideshow of stills at the sizes these render — and abstract
 * shapes say nothing about what the product is. Replaced outright rather than
 * re-timed.
 *
 * Each motif is a recognisable piece of hardware with motion that reads at a
 * glance and repeats under a second: a d-pad pressing around its axis, a disc
 * spinning under a tracking head, a stick tilting, a handheld's scanline with a
 * power LED. Everything is `currentColor` so the icon-pack and platform-accent
 * tokens restyle them for free.
 *
 * Ids are new; normalizeLoadingMotifId falls back for any stale value still
 * stored in settings, so a saved preference cannot blank the indicator.
 */
import './LoadingMotif.css'
import { SYSTEM_MOTIFS } from './systemMotifCatalogue'
import { SystemMotifArt } from './systemMotifArt'

/** id -> catalogue row, for the 72 per-system motifs (GT-B24). */
const SYSTEM_BY_ID = new Map(SYSTEM_MOTIFS.map((row) => [row.id, row]))

export const LOADING_MOTIF_IDS = ['dpad', 'disc', 'stick', 'handheld', 'cart', 'crt']

/** Retired abstract set → nearest replacement, so stored settings keep working. */
const LEGACY_MOTIF_ALIASES = {
  // 'arcade' is deliberately absent: it is now a real system id (the Arcade
  // platform), and the per-system lookup shadows this map. That is the better
  // outcome — someone who picked "arcade" gets a cabinet, not a d-pad — but it
  // means the alias would never fire, so listing it here would be a lie.

  ring: 'disc',
  orbit: 'disc',
  pulse: 'crt',
  blocks: 'cart',
  scan: 'crt',
}


const MARKUP = {
  // NES / SNES era — the d-pad presses around its axis.
  dpad: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect className="od-loading-motif__pad" x="18" y="8" width="12" height="32" rx="2" />
      <rect className="od-loading-motif__pad" x="8" y="18" width="32" height="12" rx="2" />
      <circle className="od-loading-motif__dpad-press" cx="24" cy="13" r="3" />
      <circle className="od-loading-motif__dpad-press od-loading-motif__dpad-press--r" cx="35" cy="24" r="3" />
      <circle className="od-loading-motif__dpad-press od-loading-motif__dpad-press--d" cx="24" cy="35" r="3" />
      <circle className="od-loading-motif__dpad-press od-loading-motif__dpad-press--l" cx="13" cy="24" r="3" />
    </svg>
  ),
  // Disc era — platter spins, tracking head sweeps.
  disc: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <g className="od-loading-motif__platter">
        <circle className="od-loading-motif__disc-edge" cx="24" cy="24" r="15" />
        <path className="od-loading-motif__disc-glint" d="M24 9a15 15 0 0 1 13 7.5" />
      </g>
      <circle className="od-loading-motif__disc-hub" cx="24" cy="24" r="4" />
      <rect className="od-loading-motif__head" x="23" y="30" width="2" height="12" rx="1" />
    </svg>
  ),
  // Modern pad — analog stick tilts around its gate.
  stick: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle className="od-loading-motif__gate" cx="24" cy="24" r="15" />
      <g className="od-loading-motif__stick">
        <circle className="od-loading-motif__stick-cap" cx="24" cy="24" r="7" />
      </g>
    </svg>
  ),
  // Handheld — screen refreshes under a pulsing power LED.
  handheld: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect className="od-loading-motif__shell" x="12" y="6" width="24" height="36" rx="3" />
      <rect className="od-loading-motif__screen" x="16" y="11" width="16" height="13" rx="1" />
      <rect className="od-loading-motif__scanline" x="16" y="12" width="16" height="2" />
      <circle className="od-loading-motif__led" cx="16.5" cy="28.5" r="1.5" />
      <rect className="od-loading-motif__pad" x="17" y="32" width="7" height="2.2" rx="1" />
      <rect className="od-loading-motif__pad" x="19.4" y="29.6" width="2.2" height="7" rx="1" />
    </svg>
  ),
  // Cartridge slotting home.
  cart: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path className="od-loading-motif__slot" d="M11 30h26v10H11z" />
      <g className="od-loading-motif__cart">
        <rect className="od-loading-motif__cart-body" x="15" y="8" width="18" height="20" rx="2" />
        <rect className="od-loading-motif__cart-label" x="18" y="11" width="12" height="7" rx="1" />
        <path className="od-loading-motif__cart-pins" d="M18 25h12" />
      </g>
    </svg>
  ),
  // CRT — the set the whole library grew up on.
  crt: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect className="od-loading-motif__tube" x="7" y="10" width="34" height="24" rx="4" />
      <rect className="od-loading-motif__raster" x="10" y="13" width="28" height="4" />
      <path className="od-loading-motif__stand" d="M19 34v4h10v-4M15 38h18" />
    </svg>
  ),
}

export function normalizeLoadingMotifId(id) {
  const text = String(id || '').trim().toLowerCase()
  if (LOADING_MOTIF_IDS.includes(text)) return text
  // Per-system ids (nes, psx, dreamcast, …) are equally valid picks.
  if (SYSTEM_BY_ID.has(text)) return text
  // A saved preference naming a retired abstract motif maps to its nearest
  // replacement rather than returning null — otherwise every member who had
  // ever picked one would silently fall back to the default.
  return LEGACY_MOTIF_ALIASES[text] || null
}

export function pickLoadingMotifId(settings, sessionPick) {
  const mode = settings?.loading_icon_mode || 'rotate'
  const locked = normalizeLoadingMotifId(settings?.resolved_id || settings?.loading_icon_id)
  if (mode === 'lock' && locked) {
    return locked
  }
  if (sessionPick && normalizeLoadingMotifId(sessionPick)) {
    return sessionPick
  }
  let pool = LOADING_MOTIF_IDS
  if (Array.isArray(settings?.catalogue) && settings.catalogue.length) {
    const fromApi = settings.catalogue
      .map((row) => normalizeLoadingMotifId(row?.id))
      .filter(Boolean)
    if (fromApi.length) {
      pool = fromApi
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Animated loading glyph. Pass `motifId` to lock; otherwise rotates via settings.
 */
export function LoadingMotif({
  motifId = null,
  size = 'md',
  className = '',
  title = 'Loading',
}) {
  // 'ring' was the old default and no longer exists in MARKUP — leaving it
  // here would render an empty span for any unrecognised id.
  const id = normalizeLoadingMotifId(motifId) || 'dpad'
  const sizeClass = size === 'sm'
    ? 'od-loading-motif--sm'
    : size === 'lg'
      ? 'od-loading-motif--lg'
      : ''
  return (
    <span
      className={`od-loading-motif ${sizeClass}${className ? ` ${className}` : ''}`.trim()}
      data-motif={id}
      role="img"
      aria-label={title}
    >
      {SYSTEM_BY_ID.has(id) ? (
        <SystemMotifArt
          archetype={SYSTEM_BY_ID.get(id).archetype}
          variant={SYSTEM_BY_ID.get(id).variant}
        />
      ) : (
        MARKUP[id] || MARKUP.dpad
      )}
    </span>
  )
}
