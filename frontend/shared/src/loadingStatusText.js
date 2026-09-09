/** Strip a trailing ellipsis so PageStatus can animate dots separately. */
export function loadingMessageBase(message) {
  const text = String(message || 'Loading').trim()
  return text.replace(/(?:\s*\.{1,3}|\s*…)\s*$/u, '') || 'Loading'
}

/** Visible cycle: " ." → " .." → " ..." (leading space before the first dot). */
export function loadingEllipsisFrame(tick) {
  const n = (Math.max(0, Number(tick) || 0) % 3) + 1
  return ` ${'.'.repeat(n)}`
}
