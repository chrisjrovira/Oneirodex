import { createRequester, type OneirodexClientConfig } from './client.js'
import { createAccountApi } from './account.js'
import { createBrowseApi } from './browse.js'
import { createCollectionsApi } from './collections.js'
import { createDeviceApi } from './device.js'
import { createDiscoverApi } from './discover.js'
import { createDownloadsApi } from './downloads.js'
import { createGameApi } from './game.js'
import { createLibraryApi } from './library.js'
import { createPlaytimeApi } from './playtime.js'
import { createTokensApi } from './tokens.js'
import { createUpdatesApi } from './updates.js'
import { createWishlistApi } from './wishlist.js'

export { formatBearerAuthorization, OneirodexApiError } from './client.js'

export function createOneirodexClient(config: OneirodexClientConfig) {
  const request = createRequester(config)

  return {
    request,
    tokens: createTokensApi(request),
    playtime: createPlaytimeApi(request),
    browse: createBrowseApi(request),
    updates: createUpdatesApi(request),
    downloads: createDownloadsApi(request),
    device: createDeviceApi(request),
    library: createLibraryApi(request),
    game: createGameApi(request),
    collections: createCollectionsApi(request),
    discover: createDiscoverApi(request),
    account: createAccountApi(request),
    wishlist: createWishlistApi(request),
  }
}

export type OneirodexClient = ReturnType<typeof createOneirodexClient>
