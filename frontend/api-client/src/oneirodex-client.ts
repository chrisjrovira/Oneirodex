import { createRequester, type OneirodexClientConfig } from './client.js'
import { createBrowseApi } from './browse.js'
import { createDownloadsApi } from './downloads.js'
import { createPlaytimeApi } from './playtime.js'
import { createTokensApi } from './tokens.js'
import { createUpdatesApi } from './updates.js'

export { formatBearerAuthorization, OneirodexApiError, GamethecaApiError } from './client.js'

export function createOneirodexClient(config: OneirodexClientConfig) {
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

/** @deprecated P3b alias — use createOneirodexClient. */
export const createGamethecaClient = createOneirodexClient

export type OneirodexClient = ReturnType<typeof createOneirodexClient>
/** @deprecated P3b alias — use OneirodexClient. */
export type GamethecaClient = OneirodexClient
