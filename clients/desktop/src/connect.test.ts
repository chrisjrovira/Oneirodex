import { describe, expect, it, vi } from 'vitest'
import { GamethecaApiError } from '@gametheca/api-client'
import type { GamethecaClient } from '@gametheca/api-client'

import {
  fetchLibraryPreview,
  formatDesktopApiError,
  mergeUpdateSignalsFromLibrary,
  validateConnection,
} from './connect.js'
import { createLifecycleRegistry } from './lifecycle.js'

function mockClient(partial: Partial<GamethecaClient>): GamethecaClient {
  return partial as GamethecaClient
}

describe('validateConnection', () => {
  it('succeeds when collections endpoint returns data', async () => {
    const client = mockClient({
      browse: {
        listCollections: vi.fn(async () => [{ id: 1, name: 'Main' }]),
        search: vi.fn(),
      },
    })

    const result = await validateConnection(client)
    expect(result).toEqual({ ok: true, collectionCount: 1 })
  })

  it('returns error message when API call fails', async () => {
    const client = mockClient({
      browse: {
        listCollections: vi.fn(async () => {
          throw new Error('Unauthorized')
        }),
        search: vi.fn(),
      },
    })

    const result = await validateConnection(client)
    expect(result).toEqual({ ok: false, message: 'Unauthorized' })
  })

  it('maps 403 API errors to scope guidance', async () => {
    const client = mockClient({
      browse: {
        listCollections: vi.fn(async () => {
          throw new GamethecaApiError(403, { error: 'forbidden' })
        }),
        search: vi.fn(),
      },
    })

    const result = await validateConnection(client)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('403')
      expect(result.message).toContain('read:library')
    }
  })
})

describe('formatDesktopApiError', () => {
  it('maps permission-style Tauri errors', () => {
    expect(formatDesktopApiError(new Error('Command append_file_bytes not allowed'))).toContain(
      'Companion permission error',
    )
  })
})

describe('fetchLibraryPreview', () => {
  it('returns search results from games array', async () => {
    const client = mockClient({
      browse: {
        listCollections: vi.fn(),
        search: vi.fn(async () => ({
          games: [
            { uuid: 'game-1', name: 'Doom' },
            { uuid: 'game-2', name: 'Quake' },
          ],
        })),
      },
    })

    const games = await fetchLibraryPreview(client, 5)
    expect(games).toHaveLength(2)
    expect(games[0]?.name).toBe('Doom')
  })
})

describe('mergeUpdateSignalsFromLibrary', () => {
  it('signals update_available for installed games flagged by search', () => {
    const registry = createLifecycleRegistry()
    registry.apply('a', 'download')
    registry.apply('a', 'install')
    registry.apply('b', 'download')
    registry.apply('b', 'install')

    const n = mergeUpdateSignalsFromLibrary(registry, [
      { uuid: 'a', name: 'A', has_updates: true },
      { uuid: 'b', name: 'B', lifecycle_state: 'update_available' },
      { uuid: 'c', name: 'C', has_updates: true },
    ])

    expect(n).toBe(2)
    expect(registry.get('a')).toBe('update_available')
    expect(registry.get('b')).toBe('update_available')
    expect(registry.get('c')).toBe('not_downloaded')
  })
})
