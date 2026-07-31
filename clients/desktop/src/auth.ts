import { formatBearerAuthorization } from '@gametheca/api-client'

/** OS / secure-store persistence for the API token. */
export interface KeychainAdapter {
  load(): Promise<string | null>
  save(token: string): Promise<void>
  clear(): Promise<void>
}

export interface AuthConfig {
  baseUrl: string
  token?: string | null
  keychain?: KeychainAdapter
}

export interface AuthSnapshot {
  baseUrl: string
  hasToken: boolean
}

export function createAuthStore(initial?: Partial<AuthConfig>) {
  let baseUrl = initial?.baseUrl ? normalizeBaseUrl(initial.baseUrl) : ''
  let token: string | null = initial?.token ?? null

  return {
    getBaseUrl(): string {
      return baseUrl
    },

    setBaseUrl(nextBaseUrl: string): void {
      baseUrl = normalizeBaseUrl(nextBaseUrl)
    },

    getToken(): string | null {
      return token
    },

    setToken(nextToken: string | null): void {
      token = nextToken
    },

    /** Load token from the OS secure store when an adapter is provided. */
    async hydrateFromKeychain(keychain?: KeychainAdapter): Promise<void> {
      if (!keychain) {
        return
      }
      const stored = await keychain.load()
      if (stored) {
        token = stored
      }
    },

    /** Persist token to the OS secure store when an adapter is provided. */
    async persistToKeychain(keychain?: KeychainAdapter): Promise<void> {
      if (!keychain) {
        return
      }
      if (token) {
        await keychain.save(token)
      } else {
        await keychain.clear()
      }
    },

    snapshot(): AuthSnapshot {
      return {
        baseUrl,
        hasToken: Boolean(token),
      }
    },

    /** Authorization header value for API requests. */
    authorizationHeader(): string | null {
      if (!token) {
        return null
      }
      return formatBearerAuthorization(token)
    },
  }
}

export type AuthStore = ReturnType<typeof createAuthStore>

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

/** BOM / zero-width chars often sneak in on clipboard paste. */
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g

/**
 * Trim paste noise before validating or storing a GameTheca API token.
 * Strips BOM/zero-width, surrounding whitespace, and wrapping quotes.
 */
export function normalizeGamethecaToken(raw: string): string {
  let value = raw.replace(INVISIBLE_CHARS, '').trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).replace(INVISIBLE_CHARS, '').trim()
  }
  return value
}

/**
 * Client-side shape check aligned with server `generate_api_token` /
 * `verify_bearer_token`: `gt_` + prefix + `_` + urlsafe secret.
 * Secret may contain `_` and `-` (`secrets.token_urlsafe`).
 */
export function isGamethecaToken(token: string): boolean {
  const normalized = normalizeGamethecaToken(token)
  if (!normalized.startsWith('gt_')) {
    return false
  }
  const body = normalized.slice('gt_'.length)
  const sep = body.indexOf('_')
  if (sep <= 0) {
    return false
  }
  const prefix = body.slice(0, sep)
  const secret = body.slice(sep + 1)
  if (!prefix || !secret) {
    return false
  }
  // Server uses token_hex(4) for prefix; accept hex-ish alphanumeric.
  if (!/^[a-zA-Z0-9]+$/.test(prefix)) {
    return false
  }
  // token_urlsafe charset: A-Za-z0-9 _ -
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) {
    return false
  }
  return true
}
