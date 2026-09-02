export const base = {
  className: 'od-icon',
  // Every glyph in this file and in railIcons.jsx is drawn on a 24x24 grid, so
  // the viewBox belongs with the rest of the shared attributes.
  //
  // It was only on the components here, and `RailIcon` spreads `base` without
  // adding one of its own — so the rail rendered 24-unit paths into an 18x18
  // viewport with no viewBox at all, which means no scaling: each glyph was
  // cropped to its top-left 18x18 corner. Icons whose strokes sit near the
  // origin survived that and looked fine, which is why this read as "some rail
  // icons are missing" rather than as one bug. The heart is drawn across the
  // full box, so Favorites lost almost all of itself.
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: 18,
  height: 18,
  'aria-hidden': true,
  focusable: 'false',
}

export function IconCompass(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconGamepad(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
    </svg>
  )
}

export function IconDownload(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  )
}

export function IconHeart(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

export function IconCogs(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

export function IconMore(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} data-icon="more" {...props}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} data-icon="menu" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function IconUser(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} data-icon="user" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

export function IconSystems(props) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export const primaryIconById = {
  discover: IconCompass,
  library: IconGamepad,
  systems: IconSystems,
  downloads: IconDownload,
  favorites: IconHeart,
  admin: IconCogs,
}