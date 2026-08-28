/**
 * Two-bar chrome is the product default (UIR-1 / GT-B2).
 *
 * Pages used to treat a missing `enableNewChrome` as off, which put Library
 * and the section pages back on the old in-page heading + filter rail whenever
 * the attribute was absent or a test omitted it. Only an explicit `false`
 * keeps the retired layout.
 */
export function usesNewChrome(shellConfig = {}) {
  return shellConfig.enableNewChrome !== false
}
