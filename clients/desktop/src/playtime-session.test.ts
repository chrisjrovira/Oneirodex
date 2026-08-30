import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGamethecaClient } from '@oneirodex/api-client'

import { watchPlaySession } from './playtime-session.js'

describe('playtime session watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('heartbeats while the process is running and stops when it exits', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/heartbeat') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 7, status: 'active' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/stop') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 7, status: 'ended' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404 })
    })

    const api = createGamethecaClient({
      baseUrl: 'https://example.com',
      getToken: () => 'gt_abcd_secret',
      fetchImpl,
    })

    let running = true
    const watcher = watchPlaySession(api, 4242, 7, {
      pollIntervalMs: 1000,
      isProcessRunning: async () => running,
    })

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/api/playtime/sessions/7/heartbeat',
      expect.objectContaining({ method: 'POST' }),
    )

    running = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/api/playtime/sessions/7/stop',
      expect.objectContaining({ method: 'POST' }),
    )

    await watcher.stop()
    vi.useRealTimers()
  })
})
