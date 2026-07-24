import { formatBearerAuthorization } from '@gametheca/api-client'

/** OS keychain persistence — not wired yet (Tauri / keytar). */
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

    /** Placeholder: load token from OS keychain when adapter is provided. */
    async hydrateFromKeychain(keychain?: KeychainAdapter): Promise<void> {
      if (!keychain) {
        return
      }
      const stored = await keychain.load()
      if (stored) {
        token = stored
      }
    },

    /** Placeholder: persist token to OS keychain when adapter is provided. */
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

export function isGamethecaToken(token: string): boolean {
  return /^gt_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/.test(token.trim())
}
