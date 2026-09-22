/**
 * Era-drawn rail glyphs — the second half of E4.
 *
 * The icon-pack tokens restyle every glyph's stroke, cap and fill per theme
 * for free, but they cannot change the *drawing*. A 1980s wood den with
 * round-cornered, hairline glyphs still reads as today's UI; what makes the
 * rail belong to the room is the hand that drew it. Three hands, each on the
 * same 24-unit grid as `railIcons.tsx`, for the eight destinations a member
 * looks at most:
 *
 *   pixel    — rectilinear, stepped, no curves. Everything is a rectangle or a
 *              staircase, the way a 1-bit sprite editor makes you draw.
 *   rounded  — blobby, thick, friendly: the toy-plastic era of the mid 90s.
 *   angular  — thin diagonals and cut corners, the glossy black-slab 2000s.
 *
 * The six decade rooms map onto the three hands (`ERA_HAND`). Anything not
 * drawn here falls back to the shared set, so a room never loses a glyph.
 */
import type { ReactNode } from 'react'

export type EraHand = 'pixel' | 'rounded' | 'angular'

/** Era id (the `data-era` attribute on <html>) → drawing hand. */
export const ERA_HAND: Record<string, EraHand> = {
  wood_den_80s: 'pixel',
  arcade_cabinet: 'pixel',
  teen_bedroom_90s: 'rounded',
  carpet_den_late_90s: 'rounded',
  media_center_00s: 'angular',
  desk: 'angular',
}

/** The destinations that get an era drawing; everything else is shared. */
export const ERA_GLYPH_NAMES = [
  'discover',
  'library',
  'systems',
  'downloads',
  'favorites',
  'collections',
  'playtime',
  'chat',
] as const

const pixel: Record<string, ReactNode> = {
  // Compass as a stepped diamond with a filled needle block.
  discover: (
    <>
      <path
        d="M12 2h2v2h2v2h2v2h2v2h2v4h-2v2h-2v2h-2v2h-2v2h-2v2h-2v-2H8v-2H6v-2H4v-2H2v-4h2V8h2V6h2V4h2V2h2z"
        strokeLinejoin="miter"
      />
      <path d="M10 10h4v4h-4z" fill="currentColor" stroke="none" />
      <path d="M14 8h2v2h-2zM8 14h2v2H8z" fill="currentColor" stroke="none" />
    </>
  ),
  // Three cartridge spines on a shelf line.
  library: (
    <>
      <path d="M3 4h4v16H3z" fill="currentColor" stroke="none" />
      <path d="M9 4h4v16H9z" />
      <path d="M15 6h4v14h-4z" />
      <path d="M2 21h20" />
    </>
  ),
  // A console: box, two square buttons, a stepped controller port.
  systems: (
    <>
      <path d="M3 8h18v9H3z" strokeLinejoin="miter" />
      <path d="M6 11h3v3H6zM15 11h3v3h-3z" fill="currentColor" stroke="none" />
      <path d="M9 17v2h6v-2" />
    </>
  ),
  // A stepped arrow into a square tray.
  downloads: (
    <>
      <path d="M11 3h2v7h3l-4 4-4-4h3z" fill="currentColor" stroke="none" />
      <path d="M4 15v5h16v-5" strokeLinejoin="miter" />
    </>
  ),
  // The 8-bit heart: stepped, filled.
  favorites: (
    <>
      <path
        d="M5 4h4v2h2v2h2V6h2V4h4v2h2v6h-2v2h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5v-2H3V6h2z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  // Stacked square tiles.
  collections: (
    <>
      <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3z" strokeLinejoin="miter" />
      <path d="M13 13h8v8h-8z" fill="currentColor" stroke="none" />
    </>
  ),
  // Hourglass built from steps.
  playtime: (
    <>
      <path
        d="M6 3h12v2h-2v2h-2v2h-2v2h2v2h2v2h2v2h2v2H4v-2h2v-2h2v-2h2v-2h2v-2H8V7H6V5H4V3z"
        strokeLinejoin="miter"
      />
      <path d="M10 15h4v4h-4z" fill="currentColor" stroke="none" />
    </>
  ),
  // A speech box with a stepped tail.
  chat: (
    <>
      <path d="M3 4h18v12H11v2H9v2H7v-4H3z" strokeLinejoin="miter" />
      <path d="M7 8h10v2H7zM7 11h6v2H7z" fill="currentColor" stroke="none" />
    </>
  ),
}

const rounded: Record<string, ReactNode> = {
  discover: (
    <>
      <circle cx="12" cy="12" r="9.5" strokeWidth="2.6" />
      <path d="M15.5 8.5 13.6 13.6 8.5 15.5l1.9-5.1z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  library: (
    <>
      <rect x="2.5" y="5" width="5" height="15" rx="2.5" fill="currentColor" stroke="none" />
      <rect x="9.5" y="5" width="5" height="15" rx="2.5" strokeWidth="2.6" />
      <rect
        x="15"
        y="6"
        width="5"
        height="14"
        rx="2.5"
        transform="rotate(-14 17.5 13)"
        strokeWidth="2.6"
      />
    </>
  ),
  systems: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="5" strokeWidth="2.6" />
      <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  downloads: (
    <>
      <path d="M12 3.5v9" strokeWidth="2.8" />
      <path d="M8.5 10.5a4.5 4.5 0 0 0 7 0L12 15z" fill="currentColor" stroke="none" />
      <path d="M4.5 16.5a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5" strokeWidth="2.6" />
    </>
  ),
  favorites: (
    <>
      <path
        d="M12 20.5C6 16 3 12.5 3 9a4.8 4.8 0 0 1 9-2 4.8 4.8 0 0 1 9 2c0 3.5-3 7-9 11.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  collections: (
    <>
      <circle cx="7.5" cy="7.5" r="4" strokeWidth="2.6" />
      <circle cx="16.5" cy="7.5" r="4" strokeWidth="2.6" />
      <circle cx="7.5" cy="16.5" r="4" strokeWidth="2.6" />
      <circle cx="16.5" cy="16.5" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  playtime: (
    <>
      <circle cx="12" cy="13" r="8" strokeWidth="2.6" />
      <path d="M12 9v4.5l3 2" strokeWidth="2.6" />
      <path d="M9 2.5h6" strokeWidth="2.8" />
    </>
  ),
  chat: (
    <>
      <path
        d="M12 3.5c-5 0-9 3.2-9 7.2 0 2.3 1.3 4.3 3.4 5.6L5.5 20.5l4.6-2.2c.6.1 1.2.2 1.9.2 5 0 9-3.2 9-7.2s-4-7.3-9-7.3z"
        strokeWidth="2.6"
      />
      <circle cx="8.5" cy="10.8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
}

const angular: Record<string, ReactNode> = {
  discover: (
    <>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="m14.6 9.4-1.8 5.2-3.4-3.4z" fill="currentColor" stroke="none" />
    </>
  ),
  library: (
    <>
      <path d="M3 4h4l1 16H3z" fill="currentColor" stroke="none" />
      <path d="M9.5 4h4l1 16h-4z" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="m16 5.2 3.8.8-2.4 14-3.8-.8z" strokeWidth="1.6" strokeLinejoin="miter" />
    </>
  ),
  systems: (
    <>
      <path d="M3 9h16l2 2v6H5l-2-2z" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M6 12h6M6 14.5h4" strokeWidth="1.6" />
      <path d="M17 12.5h1.5" strokeWidth="2.6" />
    </>
  ),
  downloads: (
    <>
      <path d="M12 3v8.5" strokeWidth="1.8" />
      <path d="m7.5 10 4.5 5 4.5-5z" fill="currentColor" stroke="none" />
      <path d="M3 15v3l2 2h14l2-2v-3" strokeWidth="1.6" strokeLinejoin="miter" />
    </>
  ),
  favorites: (
    <>
      <path d="M12 21 3 12V6l3-3h3l3 3 3-3h3l3 3v6z" fill="currentColor" stroke="none" />
      <path
        d="M12 21 3 12V6l3-3h3l3 3 3-3h3l3 3v6z"
        strokeWidth="1.2"
        strokeLinejoin="miter"
        fill="none"
      />
    </>
  ),
  collections: (
    <>
      <path
        d="M3 5l2-2h5v7l-2 2H3zM14 3h5l2 2v7h-5l-2-2zM3 14l2-2h5v7l-2 2H3z"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
      <path d="M14 12h5l2 2v7h-5l-2-2z" fill="currentColor" stroke="none" />
    </>
  ),
  playtime: (
    <>
      <path d="M12 3 21 8v8l-9 5-9-5V8z" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M12 8v5l3.5 2" strokeWidth="1.8" />
    </>
  ),
  chat: (
    <>
      <path d="M3 4h18v11h-9l-5 4v-4H3z" strokeWidth="1.6" strokeLinejoin="miter" />
      <path d="M7 8h10M7 11h6" strokeWidth="1.6" />
    </>
  ),
}

const HANDS: Record<EraHand, Record<string, ReactNode>> = { pixel, rounded, angular }

/** The era drawing for `name` in `era`, or null when the shared glyph should be used. */
export function eraGlyph(name: string, era: string | null | undefined): ReactNode | null {
  if (!era) return null
  const hand = ERA_HAND[era]
  if (!hand) return null
  return HANDS[hand][name] ?? null
}

/** Theme slugs whose rail is drawn in the room's hand: the decade rooms and the
 * system-family packs. Colour cabinets and the default theme keep the shared
 * glyphs — they sit in a room for scenery, not for period chrome, and the
 * default rail must not change under every household at once. */
export function themeUsesEraGlyphs(themeSlug: string | null | undefined): boolean {
  return /^(era|console)-/.test(themeSlug || '')
}

/** The era whose hand should draw the rail right now, from <html>'s
 * `data-theme` / `data-era` (the Jinja shell sets both per theme), or null. */
export function eraForGlyphs(): string | null {
  if (typeof document === 'undefined') return null
  const root = document.documentElement
  if (!themeUsesEraGlyphs(root.getAttribute('data-theme'))) return null
  return root.getAttribute('data-era')
}
