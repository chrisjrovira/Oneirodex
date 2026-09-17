export {
  createOneirodexClient,
  createOneirodexBrowserClient,
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
  OpsApi,
  OpsSummaryResponse,
  OpsSummaryOptions,
  OpsSystemDetail,
  OpsLogEvent,
  OpsLogsResponse,
  OpsLogsOptions,
} from './ops.js'
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
  ScanQueueFields,
  StartLibraryScanRequest,
  ScanStartResponse,
  BatchLibraryScanRequest,
  BatchLibraryEditRequest,
  BatchLibraryResult,
  RefreshAllLibrariesRequest,
  ScanJobRow,
} from './library.js'
export type {
  LibraryToolsApi,
  ProposeLeafLibrariesRequest,
  ProposeLeafLibrariesResponse,
  LeafLibraryCandidate,
  ImportLeafLibrariesPreviewResponse,
  ImportLeafLibrariesPreviewError,
} from './library-tools.js'
export type { GameApi, GameDetails, MoreFromResponse, EditionsResponse } from './game.js'
// Every resource factory is a value export so a SPA can bind one module to
// its own requester (`memberResource(createXApi)`) without pulling the whole
// composed client into its bundle. Until 2026-09-17 only collections was
// exported this way -- which is why it was the only module any SPA adopted.
export { createAccountApi } from './account.js'
export { createAdminArtApi } from './admin-art.js'
export { createAdminUsersApi } from './admin-users.js'
export { createBrowseApi } from './browse.js'
export { createCollectionsApi } from './collections.js'
export { createDeviceApi } from './device.js'
export { createDiscoverApi } from './discover.js'
export { createDownloadsApi } from './downloads.js'
export { createGameApi } from './game.js'
export { createLibraryApi } from './library.js'
export { createLibraryToolsApi } from './library-tools.js'
export { createOpsApi } from './ops.js'
export { createPlaytimeApi } from './playtime.js'
export { createTokensApi } from './tokens.js'
export { createUpdatesApi } from './updates.js'
export { createWishlistApi } from './wishlist.js'
export type {
  UpdatesInboxOptions,
  UpdatesScanBody,
  UpdatesScanResponse,
  StoreSearchOptions,
  StoreSearchResponse,
  WantedUpdateBody,
} from './updates.js'
export type { ListRequestsOptions, ResolveRequestBody } from './wishlist.js'
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
export type {
  AdminUsersApi,
  AdminUserRow,
  AdminUsersResponse,
  UpsertAdminUserRequest,
  AdminUserResult,
  AdminInviteQuotaRow,
  AdminInviteQuotasResponse,
} from './admin-users.js'
export type {
  AdminArtApi,
  ArtStudioPreviewRequest,
  ArtStudioPreviewResponse,
  ArtStudioGenerateRequest,
  ArtStudioGenerateResponse,
  ArtStudioApplyRequest,
  ArtStudioApplyResponse,
  ArtStudioBatchGenerateRequest,
  ArtStudioBatchResult,
  StockGenerateRequest,
  SystemMarksGenerateRequest,
  SystemMarksGenerateResponse,
  CoversSearchRequest,
  CoversApplyRequest,
  CoversBatchRequest,
  CoversBatchResult,
  ArtworkGenerateRequest,
  DownloadImagesRequest,
  DownloadImagesResult,
} from './admin-art.js'
