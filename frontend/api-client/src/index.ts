export {
  createOneirodexClient,
  formatBearerAuthorization,
  OneirodexApiError,
} from './oneirodex-client.js'
export { createRequester, joinUrl, parseErrorBody, unwrapResponse } from './client.js'
export type { OneirodexClientConfig, Requester, ErrorBody } from './client.js'
export { createBrowserRequester } from './transport-browser.js'
export type { BrowserTransportConfig } from './transport-browser.js'
export type { OneirodexClient } from './oneirodex-client.js'
export { isApiError } from './types.js'
export type * from './types.js'
export type { TokensApi } from './tokens.js'
export type { PlaytimeApi } from './playtime.js'
export type { BrowseApi, SearchOptions } from './browse.js'
export type { UpdatesApi } from './updates.js'
export type {
  DownloadsApi,
  GameVersionItem,
  InitiateDownloadOptions,
  InitiateDownloadResponse,
} from './downloads.js'
export type {
  ClientCapabilities,
  DeviceApi,
  DeviceKind,
  HeartbeatRequest,
  HeartbeatResponse,
  RawCompanionCommand,
} from './device.js'
export type {
  LibraryApi,
  LibrarySummary,
  GetLibrariesResponse,
  LibraryWatchState,
} from './library.js'
export type { GameApi, GameDetails, MoreFromResponse, EditionsResponse } from './game.js'
export type {
  CollectionsApi,
  CollectionDetail,
  ListCollectionsResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from './collections.js'
export type {
  DiscoverApi,
  DiscoverFeed,
  DiscoverRow,
  DiscoverPins,
  DiscoverRowWindow,
} from './discover.js'
export type {
  AccountApi,
  AccountSummary,
  ChangePasswordRequest,
  AccountInvite,
  AccountInvitesResponse,
} from './account.js'
export type {
  WishlistApi,
  GameRequestRow,
  ListRequestsResponse,
  CreateRequestBody,
  BatchWishlistResponse,
  FavoritesPage,
  FavoritesOptions,
} from './wishlist.js'
