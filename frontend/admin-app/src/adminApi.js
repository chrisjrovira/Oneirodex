/** Shared admin SPA fetch helpers (CSRF + session). */

export function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `${url} ${response.status}`)
  }
  return data
}

export async function postJson(url, body) {
  const { ok, status, data } = await postJsonResult(url, body)
  if (!ok) {
    throw new Error(data.error || data.message || `${url} ${status}`)
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
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
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
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify(body ?? {}),
  })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `${url} ${response.status}`)
  }
  return data
}

export async function deleteJson(url, body) {
  const headers = { 'X-CSRFToken': csrfToken() }
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
    throw new Error(data.error || data.message || `${url} ${response.status}`)
  }
  return data
}
