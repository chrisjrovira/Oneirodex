import { joinUrl, unwrapResponse, type OneirodexClientConfig, type Requester } from './client.js'

/**
 * Same-origin browser transport for the React SPAs (Phase 3, Track B).
 *
 * Differences from the default Bearer transport (`createRequester`):
 *
 *  - `credentials: 'include'` on every call — the session is a cookie, not a
 *    header.
 *  - `X-CSRFToken` is set on mutating requests (POST / PUT / PATCH / DELETE)
 *    from `config.csrfToken()`. The client never reads a SPA's token store —
 *    the SPA injects the getter.
 *  - `config.onUnauthorized()` fires once on a `401` before the
 *    `OneirodexApiError` is thrown, so the SPA can bounce to `/login`.
 *
 * `getToken` is not used here; pass a no-op (`() => null`) if the shared config
 * type requires it.
 */
export type BrowserTransportConfig = Omit<OneirodexClientConfig, 'getToken'> &
  Partial<Pick<OneirodexClientConfig, 'getToken'>>

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function createBrowserRequester(config: BrowserTransportConfig): Requester {
  const fetchImpl = config.fetchImpl ?? fetch

  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    const method = (init.method ?? 'GET').toUpperCase()
    if (MUTATING.has(method) && config.csrfToken && !headers.has('X-CSRFToken')) {
      headers.set('X-CSRFToken', config.csrfToken())
    }

    const response = await fetchImpl(joinUrl(config.baseUrl, path), {
      ...init,
      headers,
      credentials: 'include',
    })

    if (response.status === 401 && config.onUnauthorized) {
      config.onUnauthorized()
    }

    return unwrapResponse<T>(response)
  }
}
