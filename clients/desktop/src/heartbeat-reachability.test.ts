import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAuthStore } from './auth.js'
import { startClientHeartbeat } from './heartbeat.js'

describe('startClientHeartbeat reachability', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onUnreachable after consecutive failures, then onReachable on recovery', async () => {
    vi.useFakeTimers()
    const auth = createAuthStore()
    auth.setBaseUrl('https://example.com')
    auth.setToken('gt_prefix_secret')

    const onReachable = vi.fn()
    const onUnreachable = vi.fn()
    let fail = true
    const fetchImpl = vi.fn().mockImplementation(async () => {
      if (fail) {
        return { ok: false, status: 503, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ commands: [] }) }
    })

    const scheduler = startClientHeartbeat(auth, {
      intervalMs: 1000,
      unreachableAfterFailures: 2,
      fetchImpl: fetchImpl as typeof fetch,
      onReachable,
      onUnreachable,
    })

    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    expect(onUnreachable).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    expect(onUnreachable).toHaveBeenCalledTimes(1)

    fail = false
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()
    expect(onReachable).toHaveBeenCalled()

    scheduler.stop()
  })
})
