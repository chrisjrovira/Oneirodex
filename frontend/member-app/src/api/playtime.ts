import { createPlaytimeApi } from '@oneirodex/api-client'

import { memberResource, withMemberError } from './client'

const playtime = memberResource(createPlaytimeApi)

export async function fetchMyPlaytime({ signal }: { signal?: AbortSignal } = {}) {
  return withMemberError(playtime.me(signal), 'playtime/me')
}
