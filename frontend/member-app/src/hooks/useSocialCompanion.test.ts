import { act, renderHook } from '@testing-library/react'
import { useSocialCompanion } from './useSocialCompanion'

describe('useSocialCompanion SSE gating', () => {
  let EventSourceMock
  let instances

  beforeEach(() => {
    instances = []
    EventSourceMock = vi.fn(function EventSource(url) {
      this.url = url
      this.addEventListener = vi.fn()
      this.close = vi.fn()
      this.onerror = null
      instances.push(this)
    })
    vi.stubGlobal('EventSource', EventSourceMock)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          friends: [],
          friend_count: 0,
          pending_incoming: 0,
          now_playing: [],
          presence: [],
        }),
      })),
    )
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('does not open EventSource when sseEnabled is false', async () => {
    const { unmount } = renderHook(() => useSocialCompanion({ enabled: true, sseEnabled: false }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(EventSourceMock).not.toHaveBeenCalled()
    unmount()
  })

  test('opens EventSource after defer when sseEnabled is true', async () => {
    const { unmount } = renderHook(() => useSocialCompanion({ enabled: true, sseEnabled: true }))
    expect(EventSourceMock).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(EventSourceMock).toHaveBeenCalledWith('/api/activity/stream')
    unmount()
    expect(instances[0]?.close).toHaveBeenCalled()
  })
})
