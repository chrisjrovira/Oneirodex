import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useVisibilityPoll } from './useVisibilityPoll'

describe('useVisibilityPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('skips interval ticks while the tab is hidden', async () => {
    const cb = vi.fn(() => Promise.resolve())
    renderHook(() => useVisibilityPoll(cb, 4000))
    expect(cb).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    await act(async () => {
      vi.advanceTimersByTime(12000)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('does not start a second poll while one is in flight', async () => {
    let resolveFirst
    const cb = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    renderHook(() => useVisibilityPoll(cb, 4000))
    expect(cb).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(8000)
    })
    expect(cb).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst()
    })
  })
})
