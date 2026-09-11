/**
 * Member 401 -> /login, centralised in one place.
 *
 * admin-app already does this: every verb in `adminApi.js` redirects to /login
 * on a 401. The member SPA's ~35 `src/api/` modules had no equivalent, so a
 * session that expired mid-visit turned every panel into an error card reading
 * "unauthorized" with no way forward.
 *
 * Threading the check through every module (and keeping new ones honest) is a
 * lot of surface for one behaviour. Instead this wraps `window.fetch` once at
 * boot (see `main.tsx`): any same-origin response to an `/api/...` path with
 * status 401 sends the browser to /login, once. The caller's own envelope
 * error still propagates for the brief moment before the navigation lands, so
 * nothing downstream has to change.
 *
 * Not covered, by design and matching admin: `EventSource` streams (they are
 * not `fetch`), and cross-origin requests.
 */

let installed = false
let redirecting = false

function isMemberApiPath(pathname: string) {
  return pathname.startsWith('/api/') || pathname.startsWith('/admin/api/')
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  if (input && typeof input.url === 'string') {
    return input.url
  }
  return String(input ?? '')
}

/**
 * Wrap `window.fetch` so a 401 from a member API endpoint redirects to /login.
 * Idempotent; a no-op outside the browser.
 */
export function installUnauthorizedRedirect() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return
  }
  installed = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init)

    if (response.status === 401 && !redirecting) {
      let parsed = null
      try {
        parsed = new URL(requestUrl(input), window.location.origin)
      } catch {
        parsed = null
      }
      if (parsed && parsed.origin === window.location.origin && isMemberApiPath(parsed.pathname)) {
        redirecting = true
        window.location.href = '/login'
      }
    }

    return response
  }
}
