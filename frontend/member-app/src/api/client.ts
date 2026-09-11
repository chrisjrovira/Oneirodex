/**
 * Member SPA fetch helpers — the thin JSON-verb wrapper sitting on
 * `@oneirodex/api-client`'s browser transport (PR-6), matching admin-app
 * `adminApi.ts` (PR-4c / #75).
 *
 * `createBrowserRequester` already provides what each `src/api/` module used
 * to do by hand: `credentials: 'include'`, `X-CSRFToken` on mutating verbs
 * (from the injected `getCsrfToken`), and `onUnauthorized()` on a 401.
 * Wrappers keep their exported names so pages do not move.
 *
 * 401 from modules not yet on these verbs still goes through
 * `installUnauthorizedRedirect` in `http.ts`.
 */
import { getCsrfToken, errorFromBody } from '@oneirodex/ui'
import { createBrowserRequester, OneirodexApiError } from '@oneirodex/api-client'

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
        ? (body as Record<string, unknown>)
        : body
          ? { error: String(body) }
          : null
    throw errorFromBody(data, err.status, label)
  }
  throw err
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
