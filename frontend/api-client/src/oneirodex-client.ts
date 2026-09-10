import { createRequester, type OneirodexClientConfig, type Requester } from './client.js'
import { createBrowserRequester, type BrowserTransportConfig } from './transport-browser.js'
import { createAccountApi } from './account.js'
import { createBrowseApi } from './browse.js'
import { createCollectionsApi } from './collections.js'
import { createDeviceApi } from './device.js'
import { createDiscoverApi } from './discover.js'
import { createDownloadsApi } from './downloads.js'
import { createGameApi } from './game.js'
import { createLibraryApi } from './library.js'
import { createOpsApi } from './ops.js'
import { createPlaytimeApi } from './playtime.js'
import { createTokensApi } from './tokens.js'
import { createUpdatesApi } from './updates.js'
import { createWishlistApi } from './wishlist.js'

export { formatBearerAuthorization, OneirodexApiError } from './client.js'

/** Bind every resource group to one requester — transport-agnostic. */
function buildClient(request: Requester) {
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
    ops: createOpsApi(request),
  }
}

/**
 * Bearer-transport client — `Authorization: Bearer gt_…` via `getToken`. The
 * default; used by the desktop companion and the thin client (ADR 0005).
 */
export function createOneirodexClient(config: OneirodexClientConfig) {
  return buildClient(createRequester(config))
}

/**
 * Same-origin browser client for the React SPAs (ADR 0005): session cookie,
 * `credentials: 'include'`, `X-CSRFToken` on mutations from an injected
 * `csrfToken()`, `onUnauthorized()` on 401. Same resource groups as the Bearer
 * client — only the transport differs.
 */
export function createOneirodexBrowserClient(config: BrowserTransportConfig) {
  return buildClient(createBrowserRequester(config))
}

export type OneirodexClient = ReturnType<typeof createOneirodexClient>
