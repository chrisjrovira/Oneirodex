import { createRequester, type GamethecaClientConfig } from './client.js'
import { createBrowseApi } from './browse.js'
import { createDownloadsApi } from './downloads.js'
import { createPlaytimeApi } from './playtime.js'
import { createTokensApi } from './tokens.js'
import { createUpdatesApi } from './updates.js'

export { formatBearerAuthorization, GamethecaApiError } from './client.js'

export function createGamethecaClient(config: GamethecaClientConfig) {
  const request = createRequester(config)

  return {
    request,
    tokens: createTokensApi(request),
    playtime: createPlaytimeApi(request),
    browse: createBrowseApi(request),
    updates: createUpdatesApi(request),
    downloads: createDownloadsApi(request),
  }
}

export type GamethecaClient = ReturnType<typeof createGamethecaClient>
