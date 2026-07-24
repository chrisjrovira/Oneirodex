import type { ApiError } from './types.js'

export interface GamethecaClientConfig {
  /** Origin or base URL, e.g. https://host.example (no trailing slash) */
  baseUrl: string
  /** Returns Bearer secret (`gt_…`) or null when unauthenticated */
  getToken: () => string | null | Promise<string | null>
  /** Inject for tests; defaults to global fetch */
  fetchImpl?: typeof fetch
}

export class GamethecaApiError extends Error {
  readonly status: number
  readonly body: ApiError | string | null

  constructor(status: number, body: ApiError | string | null) {
    const message =
      typeof body === 'object' && body && 'error' in body
        ? body.error
        : `HTTP ${status}`
    super(message)
    this.name = 'GamethecaApiError'
    this.status = status
    this.body = body
  }
}

/** Format value for Authorization header (Bearer gt_…). */
export function formatBearerAuthorization(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) {
    throw new Error('Token must not be empty')
  }
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/^bearer/i, 'Bearer')
  }
  return `Bearer ${trimmed}`
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

async function parseErrorBody(response: Response): Promise<ApiError | string | null> {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as ApiError
  } catch {
    return text
  }
}

export function createRequester(config: GamethecaClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch

  return async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    const token = await config.getToken()
    if (token) {
      headers.set('Authorization', formatBearerAuthorization(token))
    }

    const response = await fetchImpl(joinUrl(config.baseUrl, path), {
      ...init,
      headers,
    })

    if (!response.ok) {
      throw new GamethecaApiError(response.status, await parseErrorBody(response))
    }

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return undefined as T
    }

    return (await response.json()) as T
  }
}

export type Requester = ReturnType<typeof createRequester>
