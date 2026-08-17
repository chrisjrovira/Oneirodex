import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export async function fetchRequests({ all = false, signal } = {}) {
  const response = await fetch(all ? '/api/requests?all=1' : '/api/requests', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'requests')
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
    throw await errorFromResponse(response, 'create request')
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
    throw await errorFromResponse(response, 'delete request')
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
    throw await errorFromResponse(response, 'resolve request')
  }

  return response.json()
}
