/**
 * Member SPA fetch helpers — the thin JSON-verb wrapper sitting on
 * `@oneirodex/api-client`'s browser transport (PR-6), matching admin-app
 * `adminApi.ts` (PR-4c / #75).
 *
 * `createBrowserRequester` already provides what each `src/api/` module used
 * to do by hand: `credentials: 'include'`, `X-CSRFToken` on mutating verbs
 * (from the injected `getCsrfToken`), and `onUnauthorized()` on a 401.
 * Wrappers keep their exported names so pages do not move. Typed resource
 * modules bind with `memberResource(create*Api)` + `withMemberError` so they
 * share this requester and still throw `errorFromBody`.
 *
 * 401 from modules not yet on these verbs still goes through
 * `installUnauthorizedRedirect` in `http.ts`. FormData and “return ok
 * rather than throw” paths use `send` / `sendResult`.
 */
import { getCsrfToken, errorFromBody } from '@oneirodex/ui'
import { createBrowserRequester, OneirodexApiError, type Requester } from '@oneirodex/api-client'

const request = createBrowserRequester({
  baseUrl: '',
  // Looked up per call, not captured at module-load time — member vitest
  // suites `vi.stubGlobal('fetch', ...)` / reassign `global.fetch` per test,
  // after this module (and its `createBrowserRequester` call) is already
  // loaded. Binding to `fetch` directly here would freeze on whatever the
  // global was at import time and never see those stubs.
  fetchImpl: (input, init) => fetch(input, init),
  csrfToken: getCsrfToken,
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})

type VerbOpts = { signal?: AbortSignal; label?: string }

/**
 * Re-throw a failed `request()` call as the `errorFromBody` shape (an `Error`
 * with `.status` / `.error_code` / `.data`) call sites already expect, rather
 * than leaking `OneirodexApiError` (`.body`, no `.data`) up to them.
 */
function rethrowAsMemberError(err: unknown, label: string): never {
  if (err instanceof OneirodexApiError) {
    const body = err.body
    const data =
      body && typeof body === 'object'
        ? (body as unknown as Record<string, unknown>)
        : body
          ? { error: String(body) }
          : null
    throw errorFromBody(data, err.status, label)
  }
  throw err
}

/**
 * Bind one typed `create*Api` factory to the shared browser requester so a
 * resource module does not stand up a second transport (and does not pull the
 * whole composed client into the member bundle).
 */
export function memberResource<T>(factory: (request: Requester) => T): T {
  return factory(request)
}

/** Map `OneirodexApiError` onto the `errorFromBody` shape pages already catch. */
export async function withMemberError<T>(work: Promise<T>, label: string): Promise<T> {
  try {
    return await work
  } catch (err) {
    return rethrowAsMemberError(err, label)
  }
}

export async function getJson(url: string, { signal, label }: VerbOpts = {}) {
  try {
    return await request<any>(url, { signal })
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

export async function postJson(url: string, body?: unknown, { signal, label }: VerbOpts = {}) {
  try {
    return await request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

export async function putJson(url: string, body?: unknown, { signal, label }: VerbOpts = {}) {
  try {
    return await request<any>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

export async function patchJson(url: string, body?: unknown, { signal, label }: VerbOpts = {}) {
  try {
    return await request<any>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

export async function deleteJson(url: string, body?: unknown, { signal, label }: VerbOpts = {}) {
  const init: RequestInit = { method: 'DELETE', signal }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  try {
    return await request<any>(url, init)
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

/**
 * Arbitrary `RequestInit` on the browser transport (FormData, body-less POST).
 * CSRF and 401 handling still come from `createBrowserRequester`.
 */
export async function send(url: string, init: RequestInit & { label?: string } = {}) {
  const { label, ...rest } = init
  try {
    return await request<any>(url, rest)
  } catch (err) {
    return rethrowAsMemberError(err, label ?? url)
  }
}

/**
 * POST/PUT/PATCH/DELETE that returns `{ ok, status, data }` instead of throwing
 * on 4xx/5xx (401 still redirects). Matches admin `postJsonResult`, and is what
 * batch / fire-and-forget social writes need.
 */
export async function sendResult(url: string, init: RequestInit = {}) {
  try {
    const data = await request<any>(url, init)
    return { ok: true, status: 200, data: data ?? {} }
  } catch (err) {
    if (err instanceof OneirodexApiError) {
      const body = err.body
      const data =
        body && typeof body === 'object' ? (body as unknown as Record<string, unknown>) : {}
      return { ok: false, status: err.status, data }
    }
    throw err
  }
}
