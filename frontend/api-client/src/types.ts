/** Shapes aligned with docs/openapi/openapi.json components.schemas */

export type ApiTokenScope =
  | 'read:library'
  | 'read:social'
  | 'write:presence'
  | 'write:download'
  | 'write:library'
  | 'admin'

export type ApiTokenPreset = 'companion' | 'thin'

export interface ApiTokenPublic {
  id: number
  name: string
  token_prefix: string
  scopes: ApiTokenScope[]
  created_at: string
  last_used_at: string | null
  revoked: boolean
}

export interface ApiError {
  error: string
}

export interface CreateTokenRequest {
  name: string
  scopes?: ApiTokenScope[]
  /** Shortcut: companion | thin (overrides scopes when set) */
  preset?: ApiTokenPreset
}

export interface CreateTokenResponse {
  token: ApiTokenPublic
  /** One-time secret; only returned on create */
  secret: string
  warning?: string
}

export interface ListTokensResponse {
  tokens: ApiTokenPublic[]
  valid_scopes: ApiTokenScope[]
  scope_presets: Record<string, { label?: string; scopes?: ApiTokenScope[] }>
}

export interface SearchResultItem {
  uuid: string
  name: string
  [key: string]: unknown
}

export interface SearchResponse {
  results?: SearchResultItem[]
  games?: SearchResultItem[]
  [key: string]: unknown
}

export interface CollectionSummary {
  id: number
  name: string
  [key: string]: unknown
}

export interface UpdatesInboxItem {
  game_uuid: string
  name?: string
  [key: string]: unknown
}

export interface UpdatesInboxResponse {
  behind?: UpdatesInboxItem[]
  items?: UpdatesInboxItem[]
  [key: string]: unknown
}

export interface StartPlaySessionRequest {
  game_uuid: string
  started_at?: string
  [key: string]: unknown
}

export interface PlaySessionResponse {
  id?: number
  game_uuid?: string
  started_at?: string
  [key: string]: unknown
}

export interface PlaytimeMeResponse {
  total_seconds?: number
  games?: Array<{
    game_uuid: string
    seconds?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}
