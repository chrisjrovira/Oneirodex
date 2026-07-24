import { describe, expect, it, vi } from 'vitest'
import { fetchLibraryPreview, validateConnection } from './connect.js'
import type { GamethecaClient } from '@gametheca/api-client'

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
