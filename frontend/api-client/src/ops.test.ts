import { describe, expect, it } from 'vitest'
import { createOneirodexBrowserClient } from './oneirodex-client.js'
import { harness, okEnvelope } from './test-harness.js'

describe('ops api', () => {
  it('getSummary GETs /admin/api/ops/summary', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({
        as_of: '2026-09-10T00:00:00+00:00',
        issues: { overall: 'good', items: [] },
        host: { hostname: 'ops-host' },
      }),
    )

    const summary = await client.ops.getSummary()

    expect(calls[0].url).toBe('https://host.example/admin/api/ops/summary')
    expect(calls[0].method).toBe('GET')
    expect(summary.issues?.overall).toBe('good')
    expect((summary.host as { hostname?: string }).hostname).toBe('ops-host')
  })

  it('accepts an AbortSignal without changing the path', async () => {
    const { calls, client } = harness(200, okEnvelope({}))
    const controller = new AbortController()

    await client.ops.getSummary({ signal: controller.signal })

    expect(calls[0].url).toBe('https://host.example/admin/api/ops/summary')
  })

  it('rejects with the envelope status + error_code on failure', async () => {
    const { client } = harness(503, {
      ok: false,
      error: 'Ops summary is unavailable',
      error_code: 'service_unavailable',
    })

    await expect(client.ops.getSummary()).rejects.toMatchObject({
      status: 503,
      error_code: 'service_unavailable',
    })
  })

  it('is reachable on the browser client with credentials + no bearer header', async () => {
    const seen: RequestInit[] = []
    const fetchImpl = (async (_url: string | URL, init: RequestInit = {}) => {
      seen.push(init)
      return new Response(JSON.stringify(okEnvelope({ issues: { overall: 'warn' } })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const client = createOneirodexBrowserClient({
      baseUrl: 'https://app.example',
      fetchImpl,
      csrfToken: () => 'csrf-abc',
      onUnauthorized: () => {},
    })

    const summary = await client.ops.getSummary()

    expect(summary.issues?.overall).toBe('warn')
    expect(seen[0].credentials).toBe('include')
    expect(new Headers(seen[0].headers).get('Authorization')).toBeNull()
  })
})
