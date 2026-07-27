import type { Requester } from './client.js'
import type {
  PlaySessionResponse,
  PlaytimeMeResponse,
  StartPlaySessionRequest,
} from './types.js'

export function createPlaytimeApi(request: Requester) {
  return {
    startSession(body: StartPlaySessionRequest): Promise<PlaySessionResponse> {
      return request<PlaySessionResponse>('/api/playtime/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    heartbeatSession(sessionId: number): Promise<PlaySessionResponse> {
      return request<PlaySessionResponse>(`/api/playtime/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
      })
    },

    stopSession(sessionId: number): Promise<PlaySessionResponse> {
      return request<PlaySessionResponse>(`/api/playtime/sessions/${sessionId}/stop`, {
        method: 'POST',
      })
    },

    me(): Promise<PlaytimeMeResponse> {
      return request<PlaytimeMeResponse>('/api/playtime/me')
    },
  }
}

export type PlaytimeApi = ReturnType<typeof createPlaytimeApi>
