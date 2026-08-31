import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useLibraryScanToasts } from './useLibraryScanToasts'
import { showToast } from '../utils/toast'

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(showToast).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('useLibraryScanToasts toasts library-added rows and soft-fails on error', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 99,
            kind: 'library_games_added',
            title: '2 games added to Library Arcade',
          },
        ],
      }),
    })
    .mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)

  const { unmount } = renderHook(() => useLibraryScanToasts({ intervalMs: 60_000 }))

  await waitFor(() => {
    expect(showToast).toHaveBeenCalledWith('2 games added to Library Arcade', 'success')
  })

  unmount()
  expect(fetchMock).toHaveBeenCalled()
})

test('useLibraryScanToasts stays quiet when endpoint is not ready', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
  )

  renderHook(() => useLibraryScanToasts({ intervalMs: 60_000 }))

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled()
  })
  expect(showToast).not.toHaveBeenCalled()
})

test('useLibraryScanToasts collapses more than five libraries to a count', async () => {
  const notifications = ['A', 'B', 'C', 'D', 'E', 'F'].map((library, i) => ({
    id: i + 1,
    kind: 'library_games_added',
    library,
    title: `1 games added to library ${library}`,
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notifications }),
    }),
  )

  renderHook(() => useLibraryScanToasts({ intervalMs: 60_000 }))

  await waitFor(() => {
    expect(showToast).toHaveBeenCalledWith('6 notifications', 'success', { count: 6 })
  })
  expect(showToast).toHaveBeenCalledTimes(1)
})
