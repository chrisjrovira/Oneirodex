import { describe, expect, it, vi } from 'vitest'

import { createAuthStore } from './auth.js'
import { postClientHeartbeat } from './heartbeat.js'
import { CLIENT_VERSION } from './version.js'

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(body),
    json: async () => body,
  }
}

function connectedAuth() {
  const auth = createAuthStore()
  auth.setBaseUrl('https://example.com')
  auth.setToken('gt_abcdef01_secret')
  return auth
}

async function captureHeartbeatBody(
  options: Parameters<typeof postClientHeartbeat>[1] = {},
): Promise<Record<string, unknown>> {
  const fetchImpl = vi.fn().mockResolvedValue(okResponse({ commands: [] }))
  await postClientHeartbeat(connectedAuth(), {
    ...options,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })
  const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe('heartbeat seat identity', () => {
  it('posts to the client heartbeat endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ commands: [] }))
    await postClientHeartbeat(connectedAuth(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://example.com/api/client/heartbeat')
  })

  it('defaults to the companion seat', async () => {
    // The server defaults an omitted kind to companion, but relying on that
    // leaves device_kind unreachable from any shipped client.
    const body = await captureHeartbeatBody()
    expect(body.device_kind).toBe('companion')
  })

  it('reports a thin seat when the caller asks for one', async () => {
    const body = await captureHeartbeatBody({ deviceKind: 'thin' })
    expect(body.device_kind).toBe('thin')
  })

  it('reports the real package version, not a hardcoded one', async () => {
    // '0.0.0-dev' is the guard value in version.ts — seeing it here means the
    // build-time define was dropped and every device would report a fiction.
    expect(CLIENT_VERSION).not.toBe('0.0.0-dev')
    const body = await captureHeartbeatBody()
    expect(body.client_version).toBe(CLIENT_VERSION)
    expect(body.client_version).not.toBe('0.1.0')
  })
})
