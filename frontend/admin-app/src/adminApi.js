/** Shared admin SPA fetch helpers (CSRF + session). */

export function csrfToken() {
  if (typeof document === 'undefined') {
    return ''
  }
  // base_admin.html always renders the meta tag, so the extra sources below are
  // belt-and-braces rather than a fix — but they cost nothing and they keep
  // this agreeing with the member app's lookup instead of quietly differing.
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }
  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }
  return document.getElementById('csrf_token')?.textContent || ''
}

/**
 * Request headers carrying the CSRF token.
 *
 * Eleven call sites built this inline, three of them in this file. One spelling
 * means one place to change when the header or the token source moves.
 */
export function csrfHeaders(extra = {}) {
  if (typeof window !== 'undefined' && window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(extra)
  }
  return {
    'X-CSRFToken': csrfToken(),
    ...extra,
  }
}

/**
 * Build an Error from a failed admin response.
 *
 * The four helpers below each spelled this out, and all four threw a bare
 * `Error(message)` — so a page could show the sentence but could not branch on
 * whether it was a 403 or a 500. `status` and `error_code` ride along now.
 *
 * @param {object} data    parsed response body (already read by the caller)
 * @param {number} status  HTTP status
 * @param {string} label   fallback label, usually the URL
 */
export function adminError(data, status, label) {
  const sentence = data?.error || data?.message
  const error = new Error(
    typeof sentence === 'string' && sentence.trim() ? sentence : `${label} ${status}`,
  )
  error.status = status
  if (typeof data?.error_code === 'string' && data.error_code) {
    error.error_code = data.error_code
  }
  error.data = data
  return error
}

export async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
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
