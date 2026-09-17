import { createWishlistApi } from '@oneirodex/api-client'

import { memberResource, withMemberError } from './client'

const wishlist = memberResource(createWishlistApi)

export async function fetchRequests({
  all = false,
  signal,
}: { all?: boolean; signal?: AbortSignal } = {}) {
  return withMemberError(wishlist.listRequests({ all, signal }), 'requests')
}

export async function createRequest({ title, notes }: { title?: string; notes?: string } = {}) {
  return withMemberError(
    wishlist.createRequest({ title: title ?? '', notes: notes || '' }),
    'create request',
  )
}

export async function deleteRequest(id: number | string) {
  return withMemberError(wishlist.cancelRequest(Number(id)), 'delete request')
}

export async function resolveRequest(
  id: number | string,
  {
    status,
    notes,
    linkedGameUuid,
  }: { status?: string; notes?: string; linkedGameUuid?: string } = {},
) {
  const payload: { status: string; notes?: string; linked_game_uuid?: string } = {
    status: status ?? '',
  }
  if (notes) {
    payload.notes = notes
  }
  if (linkedGameUuid) {
    payload.linked_game_uuid = linkedGameUuid
  }
  return withMemberError(wishlist.resolveRequest(Number(id), payload), 'resolve request')
}
