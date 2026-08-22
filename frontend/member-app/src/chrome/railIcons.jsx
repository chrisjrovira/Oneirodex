/**
 * Glyphs for every rail destination (GT-B3).
 *
 * The rail rendered `primaryIconById[id] || IconMore` while icons.jsx had only
 * nine components, so eighteen of the twenty-three member destinations fell
 * back to IconMore — the three-dot glyph. That row of "..." in the rail was not
 * a placeholder anyone chose; it was an exhausted lookup table.
 *
 * Generated from partials/icons.html rather than redrawn, so the SPA and the
 * Jinja pages keep speaking one visual language. That contract is stated in the
 * icons.html header and was not being kept. Same 24x24 viewBox, currentColor
 * and 2px stroke, so the icon-pack tokens restyle these for free.
 */
import { base } from './icons'

export const railIconPaths = {
  'acquire': (
    <>
      <path d="M6 3H3v9a9 9 0 0 0 18 0V3h-3v9a6 6 0 0 1-12 0V3z"/>
      <path d="M3 8h3M18 8h3"/>
    </>
  ),
  'activity': (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </>
  ),
  'admin': (
    <>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
    </>
  ),
  'big-picture': (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="m17 2-5 5-5-5"/>
    </>
  ),
  'calendar': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M16 3v4M8 3v4M3 11h18"/>
    </>
  ),
  'chat': (
    <>
      <path d="M3 11 21 6v12L3 14v-3z"/>
      <path d="M11.5 16.7a3 3 0 0 1-5.8-1.5"/>
    </>
  ),
  'collections': (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </>
  ),
  'content': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M7 8h6M7 12h10M7 16h10"/>
    </>
  ),
  'dashboard': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M10 4v16"/>
    </>
  ),
  'discover': (
    <>
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none"/>
    </>
  ),
  'downloads': (
    <>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>
    </>
  ),
  'favorites': (
    <>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
    </>
  ),
  'friends': (
    <>
      <circle cx="9" cy="8" r="4"/>
      <path d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
      <path d="M17 4.6a4 4 0 0 1 0 6.8M18.6 20c0-2.1-.7-4-1.9-5.5"/>
    </>
  ),
  'help': (
    <>
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.4"/>
      <path d="M12 17h.01"/>
    </>
  ),
  'integrations': (
    <>
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8z"/>
      <path d="M9 8V2M15 8V2M12 17v5"/>
    </>
  ),
  'libraries': (
    <>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/>
    </>
  ),
  'library': (
    <>
      <rect x="2" y="6" width="20" height="12" rx="3"/>
      <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>
    </>
  ),
  'logout': (
    <>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/>
      <path d="m16 17 5-5-5-5"/>
      <path d="M21 12H9"/>
    </>
  ),
  'news': (
    <>
      <path d="M3 11 21 6v12L3 14v-3z"/>
      <path d="M11.5 16.7a3 3 0 0 1-5.8-1.5"/>
    </>
  ),
  'notifications': (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z"/>
      <path d="M10 19a2 2 0 0 0 4 0"/>
    </>
  ),
  // A key, not a shopping bag (W28). The bag was the `store` glyph doing double
  // duty, and it said "buy something" on the one page that is about what you
  // already have. Ownership here is licences held across Steam / GOG / Epic —
  // and a game licence has been called a key for as long as it has existed, so
  // the metaphor needs no learning.
  'ownership': (
    <>
      <circle cx="7.5" cy="15.5" r="4.5"/>
      <path d="M10.7 12.3 21 2"/>
      <path d="m15.5 7.5 3 3"/>
      <path d="m18 5 3 3"/>
    </>
  ),
  'playtime': (
    <>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 2"/>
    </>
  ),
  // A speech bubble carrying an alert, not a beetle (W28). The bug glyph named
  // one *kind* of report — and at 18px a six-legged silhouette is a smudge.
  // "Report issue" is a message you send about a problem, which is exactly what
  // this draws: the bubble is the sending, the mark inside is the problem.
  'report': (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
      <path d="M12 7.5v4"/>
      <path d="M12 14h.01"/>
    </>
  ),
  'settings': (
    <>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
    </>
  ),
  'system': (
    <>
      <rect x="2" y="3" width="20" height="7" rx="2"/>
      <rect x="2" y="14" width="20" height="7" rx="2"/>
      <path d="M6 6.5h.01M6 17.5h.01"/>
    </>
  ),
  'systems': (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1"/>
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>
    </>
  ),
  'trailers': (
    <>
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5"/>
    </>
  ),
  'updates': (
    <>
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </>
  ),
  'users': (
    <>
      <circle cx="9" cy="8" r="4"/>
      <path d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
      <path d="M17 4.6a4 4 0 0 1 0 6.8M18.6 20c0-2.1-.7-4-1.9-5.5"/>
    </>
  ),
  'vr': (
    <>
      <rect x="2" y="7" width="20" height="10" rx="3"/>
      <circle cx="7.5" cy="12" r="2"/>
      <circle cx="16.5" cy="12" r="2"/>
    </>
  ),
  'wishlist': (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M8 12h8M8 16h5"/>
    </>
  ),
}

/** @param {{ name: string, size?: number }} props */
export function RailIcon({ name, size = 18, ...rest }) {
  const glyph = railIconPaths[name]
  // An unknown id renders nothing rather than a dot: a missing glyph should be
  // invisible, not a mark the eye reads as a real category.
  if (!glyph) return null
  return (
    <svg {...base} width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
      {glyph}
    </svg>
  )
}
