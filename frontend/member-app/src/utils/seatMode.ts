/**
 * Which kind of client seat is this SPA running inside? (TC-3)
 *
 * The thin shell opens the member SPA in a plain webview with a site session,
 * which on the wire is indistinguishable from any other browser tab — so the
 * server cannot tell us. The shell says so itself by opening `/?seat=thin`, and
 * we remember it for the rest of the session because the marker does not
 * survive in-app navigation.
 *
 * This is presentation honesty, not enforcement. A thin token is denied
 * `write:download` server-side and the thin build ships no install ACL at all;
 * this only stops us from offering a thin seat buttons it can never complete.
 *
 * sessionStorage rather than localStorage: a seat is a property of this window,
 * not of the browser profile. Opening the same server in a normal tab later must
 * not inherit it.
 */

const SEAT_STORAGE_KEY = 'oneirodex-seat'
const KNOWN_SEATS = new Set(['thin', 'companion', 'browser'])

function readStoredSeat() {
  try {
    const stored = sessionStorage.getItem(SEAT_STORAGE_KEY)
    return stored && KNOWN_SEATS.has(stored) ? stored : null
  } catch {
    // Private mode / blocked storage — fall through to the URL each load.
    return null
  }
}

function persistSeat(seat: any) {
  try {
    sessionStorage.setItem(SEAT_STORAGE_KEY, seat)
  } catch {
    // Non-fatal: the seat then lasts only as long as the query string does.
  }
}

/**
 * Resolve the current seat, latching the `?seat=` marker on first sight.
 *
 * @returns {'thin' | 'companion' | 'browser'}
 */
export function getSeatMode() {
  let fromUrl = null
  try {
    fromUrl = new URLSearchParams(window.location.search).get('seat')
  } catch {
    fromUrl = null
  }

  if (fromUrl && KNOWN_SEATS.has(fromUrl)) {
    persistSeat(fromUrl)
    return fromUrl
  }

  return readStoredSeat() || 'browser'
}

/** True when this window is the thin client's library webview. */
export function isThinSeat() {
  return getSeatMode() === 'thin'
}
