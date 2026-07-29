import type { Requester } from './client.js'
import type {
  CreateTokenRequest,
  CreateTokenResponse,
  ListTokensResponse,
} from './types.js'

export function createTokensApi(request: Requester) {
  return {
    list(): Promise<ListTokensResponse> {
      return request<ListTokensResponse>('/api/tokens')
    },

    create(body: CreateTokenRequest): Promise<CreateTokenResponse> {
      return request<CreateTokenResponse>('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    revoke(tokenId: number): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/api/tokens/${tokenId}`, { method: 'DELETE' })
    },
  }
}

export type TokensApi = ReturnType<typeof createTokensApi>
