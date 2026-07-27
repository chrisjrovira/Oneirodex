import type { Requester } from './client.js'
import type {
  ApiTokenPublic,
  CreateTokenRequest,
  CreateTokenResponse,
} from './types.js'

export function createTokensApi(request: Requester) {
  return {
    list(): Promise<ApiTokenPublic[]> {
      return request<ApiTokenPublic[]>('/api/tokens')
    },

    create(body: CreateTokenRequest): Promise<CreateTokenResponse> {
      return request<CreateTokenResponse>('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    revoke(tokenId: number): Promise<void> {
      return request<void>(`/api/tokens/${tokenId}`, { method: 'DELETE' })
    },
  }
}

export type TokensApi = ReturnType<typeof createTokensApi>
