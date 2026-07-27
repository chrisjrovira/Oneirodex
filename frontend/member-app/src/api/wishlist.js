function getCsrfToken() {
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

function csrfHeaders(additionalHeaders = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(additionalHeaders)
  }

  return {
    'X-CSRFToken': getCsrfToken(),
    ...additionalHeaders,
  }
}

async function errorFrom(response, fallback) {
  try {
    const data = await response.json()
    if (data?.error) {
      return new Error(data.error)
    }
  } catch {
    // Response had no JSON body; fall through to the generic message.
  }
  return new Error(fallback)
}

export async function fetchRequests({ all = false, signal } = {}) {
  const response = await fetch(all ? '/api/requests?all=1' : '/api/requests', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`requests ${response.status}`)
  }

  return response.json()
}

export async function createRequest({ title, notes } = {}) {
  const response = await fetch('/api/requests', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, notes: notes || '' }),
  })

  if (!response.ok) {
    throw await errorFrom(response, `create request ${response.status}`)
  }

  return response.json()
}

export async function deleteRequest(id) {
  const response = await fetch(`/api/requests/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })

  if (!response.ok) {
    throw await errorFrom(response, `delete request ${response.status}`)
  }

  return response.json()
}

export async function resolveRequest(id, { status, notes, linkedGameUuid } = {}) {
  const payload = { status }
  if (notes) {
    payload.notes = notes
  }
  if (linkedGameUuid) {
    payload.linked_game_uuid = linkedGameUuid
  }

  const response = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await errorFrom(response, `resolve request ${response.status}`)
  }

  return response.json()
}
