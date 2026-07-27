import type { Requester } from './client.js'
import type { UpdatesInboxResponse } from './types.js'

export function createUpdatesApi(request: Requester) {
  return {
    inbox(signal?: AbortSignal): Promise<UpdatesInboxResponse> {
      return request<UpdatesInboxResponse>('/api/updates/inbox', { signal })
    },
  }
}

export type UpdatesApi = ReturnType<typeof createUpdatesApi>
