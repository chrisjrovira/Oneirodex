import { deleteJson, getJson, patchJson, postJson } from './client'

export async function fetchRequests({ all = false, signal }: LooseProps = {}) {
  return getJson(all ? '/api/requests?all=1' : '/api/requests', {
    signal,
    label: 'requests',
  })
}

export async function createRequest({ title, notes }: LooseProps = {}) {
  return postJson('/api/requests', { title, notes: notes || '' }, { label: 'create request' })
}

export async function deleteRequest(id: any) {
  return deleteJson(`/api/requests/${id}`, undefined, { label: 'delete request' })
}

export async function resolveRequest(id: any, { status, notes, linkedGameUuid }: LooseProps = {}) {
  const payload: LooseProps = { status }
  if (notes) {
    payload.notes = notes
  }
  if (linkedGameUuid) {
    payload.linked_game_uuid = linkedGameUuid
  }

  return patchJson(`/api/requests/${id}`, payload, { label: 'resolve request' })
}
