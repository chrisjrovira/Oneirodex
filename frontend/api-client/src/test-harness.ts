import { createOneirodexClient } from './oneirodex-client.js'

export interface RecordedCall {
  url: string
  method: string
  headers: Headers
  body: string | null
}

/**
 * Shared test rig for the resource modules: a client whose injected fetch
 * records each request and replies with `body` at `status`. Not a `*.test.ts`
 * file, so vitest does not treat it as a suite.
 */
export function harness(status: number, body: unknown) {
  const calls: RecordedCall[] = []
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: (init.method ?? 'GET').toUpperCase(),
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? init.body : null,
    })
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: status === 204 ? undefined : { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch

  const client = createOneirodexClient({
    baseUrl: 'https://host.example',
    getToken: () => 'gt_ab12_secret',
    fetchImpl,
  })
  return { calls, client }
}

/** A success envelope with `payload` merged at the top level. */
export const okEnvelope = (payload: Record<string, unknown> = {}) => ({
  ok: true,
  error: null,
  error_code: null,
  ...payload,
})
