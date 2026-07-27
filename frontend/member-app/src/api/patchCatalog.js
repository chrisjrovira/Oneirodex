function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }
  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }
  return ''
}

function csrfHeaders(extra = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(extra)
  }
  return { 'X-CSRFToken': getCsrfToken(), ...extra }
}

export async function searchPatchCatalog({ gameUuid, q, signal } = {}) {
  const params = new URLSearchParams()
  if (gameUuid) {
    params.set('game_uuid', gameUuid)
  }
  if (q) {
    params.set('q', q)
  }
  const response = await fetch(`/api/patch-catalog/search?${params}`, {
    credentials: 'same-origin',
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `patch-catalog search ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export async function attachPatchCatalogGuide(body) {
  const response = await fetch('/api/patch-catalog/attach', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `patch-catalog attach ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}
