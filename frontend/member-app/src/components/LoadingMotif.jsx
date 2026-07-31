/**
 * Animated loading motifs — ids match Backend catalogue
 * (ring | orbit | pulse | blocks | scan | arcade).
 */
import './LoadingMotif.css'

export const LOADING_MOTIF_IDS = ['ring', 'orbit', 'pulse', 'blocks', 'scan', 'arcade']

const MARKUP = {
  ring: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle className="gt-loading-motif__ring" cx="24" cy="24" r="16" />
    </svg>
  ),
  orbit: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle className="gt-loading-motif__disc" cx="24" cy="24" r="14" />
      <circle className="gt-loading-motif__hub" cx="24" cy="24" r="3.5" />
      <g className="gt-loading-motif__sat">
        <circle cx="24" cy="8" r="3" />
      </g>
      <g className="gt-loading-motif__sat gt-loading-motif__sat--b">
        <circle cx="38" cy="28" r="2.25" />
      </g>
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle className="gt-loading-motif__pulse" cx="24" cy="24" r="16" />
      <circle className="gt-loading-motif__pulse gt-loading-motif__pulse--b" cx="24" cy="24" r="10" />
      <circle className="gt-loading-motif__core" cx="24" cy="24" r="4" />
    </svg>
  ),
  blocks: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect className="gt-loading-motif__block" x="6" y="22" width="8" height="8" rx="1" />
      <rect className="gt-loading-motif__block" x="16" y="22" width="8" height="8" rx="1" />
      <rect className="gt-loading-motif__block" x="26" y="22" width="8" height="8" rx="1" />
      <rect className="gt-loading-motif__block" x="36" y="22" width="6" height="8" rx="1" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect className="gt-loading-motif__frame" x="8" y="10" width="32" height="28" rx="2" />
      <rect className="gt-loading-motif__beam" x="10" y="12" width="28" height="3" rx="1" />
    </svg>
  ),
  arcade: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path className="gt-loading-motif__slot" d="M14 34h20M16 34v-8h16v8" />
      <ellipse className="gt-loading-motif__coin" cx="24" cy="14" rx="7" ry="7" />
    </svg>
  ),
}

export function normalizeLoadingMotifId(id) {
  const text = String(id || '').trim().toLowerCase()
  return LOADING_MOTIF_IDS.includes(text) ? text : null
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
  const id = normalizeLoadingMotifId(motifId) || 'ring'
  const sizeClass = size === 'sm'
    ? 'gt-loading-motif--sm'
    : size === 'lg'
      ? 'gt-loading-motif--lg'
      : ''
  return (
    <span
      className={`gt-loading-motif ${sizeClass}${className ? ` ${className}` : ''}`.trim()}
      data-motif={id}
      role="img"
      aria-label={title}
    >
      {MARKUP[id] || MARKUP.ring}
    </span>
  )
}
