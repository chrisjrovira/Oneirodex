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
  if (!response.ok) {
    throw new Error(data.error || data.message || `${url} ${response.status}`)
  }
  return data
}

export async function deleteJson(url) {
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': csrfToken() },
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
