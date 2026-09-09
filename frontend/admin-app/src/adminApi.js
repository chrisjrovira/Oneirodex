/**
 * Admin SPA fetch helpers — the thin admin wrapper (401 redirect, JSON verbs)
 * over the shared primitives.
 *
 * The CSRF lookup and the failed-response Error builder moved into
 * `@oneirodex/ui` in wave B1.2: the member SPA's fallback chain is the superset,
 * so the admin copy (meta → input → #csrf_token, plus a `data.message`
 * fallback) is now one of the behaviours that lookup already covers. Re-exported
 * here under the names admin call sites already use so their imports do not move.
 */
import { getCsrfToken, csrfHeaders, errorFromBody } from '@oneirodex/ui'

/** @deprecated import { getCsrfToken } from '@oneirodex/ui' — kept for admin call sites. */
export { getCsrfToken as csrfToken, csrfHeaders }

/**
 * Build an Error from a failed admin response.
 *
 * Was a local copy that threw a bare `Error(message)`; it now delegates to the
 * shared `errorFromBody`, which keeps `status` / `error_code` / `data` on the
 * Error and prefers `data.error` then `data.message` for the sentence — the
 * same shape this copy had. Same signature `(data, status, label)`.
 */
export const adminError = errorFromBody

export async function getJson(url, { signal } = {}) {
  const response = await fetch(url, { credentials: 'same-origin', signal })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw adminError(data, response.status, url)
  }
  return data
}

export async function postJson(url, body) {
  const { ok, status, data } = await postJsonResult(url, body)
  if (!ok) {
    throw adminError(data, status, url)
  }
  return data
}

/**
 * POST JSON and return `{ ok, status, data }` without throwing on 4xx/5xx
 * (still redirects on 401). Used for scan conflict / 409 recovery.
 */
export async function postJsonResult(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

export async function putJson(url, body) {
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw adminError(data, response.status, url)
  }
  return data
}

export async function deleteJson(url, body) {
  const headers = csrfHeaders()
  const init = {
    method: 'DELETE',
    credentials: 'same-origin',
    headers,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const response = await fetch(url, init)
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw adminError(data, response.status, url)
  }
  return data
}
