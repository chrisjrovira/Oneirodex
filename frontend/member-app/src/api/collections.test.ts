import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  addCollectionItem,
  createCollection,
  deleteCollection,
  fetchCollection,
  fetchCollections,
  removeCollectionItem,
  reorderCollectionItems,
  searchGames,
  updateCollection,
} from './collections'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return Promise.resolve({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(payload),
  })
}

describe('member collections typed resource', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf-token">'
    global.fetch = vi.fn(() => jsonResponse({ ok: true }))
  })

  afterEach(() => {
    document.head.innerHTML = ''
    delete global.fetch
  })

  test('fetchCollections GETs /api/collections over the browser transport', async () => {
    global.fetch.mockReturnValue(jsonResponse({ collections: [] }))
    await expect(fetchCollections()).resolves.toEqual({ collections: [] })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/collections',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('createCollection POSTs snake_case JSON and CSRF', async () => {
    global.fetch.mockReturnValue(jsonResponse({ uuid: 'c1', name: 'Roguelites' }, { status: 201 }))
    await expect(
      createCollection({ name: 'Roguelites', description: 'night', isPublic: false }),
    ).resolves.toMatchObject({ uuid: 'c1' })
    const [, init] = global.fetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      name: 'Roguelites',
      description: 'night',
      is_public: false,
    })
    expect(new Headers(init.headers).get('X-CSRFToken')).toBe('test-csrf-token')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  test('updateCollection PATCHes only provided fields as is_public', async () => {
    await updateCollection('abc-123', { name: 'Cozy remixed', isPublic: false })
    const [, init] = global.fetch.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(global.fetch.mock.calls[0][0]).toBe('/api/collections/abc-123')
    expect(JSON.parse(init.body)).toEqual({ name: 'Cozy remixed', is_public: false })
  })

  test('item add/remove/reorder hit the typed collection item paths', async () => {
    await addCollectionItem('c1', 'g9')
    await removeCollectionItem('c1', 'g9')
    await reorderCollectionItems('c1', ['g9', 'g2'])
    const urls = global.fetch.mock.calls.map((call) => [call[0], call[1]?.method])
    expect(urls).toEqual([
      ['/api/collections/c1/items', 'POST'],
      ['/api/collections/c1/items/g9', 'DELETE'],
      ['/api/collections/c1/items/order', 'PUT'],
    ])
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ game_uuid: 'g9' })
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({
      game_uuids: ['g9', 'g2'],
    })
  })

  test('deleteCollection and fetchCollection keep labels on envelope errors', async () => {
    global.fetch.mockReturnValueOnce(
      jsonResponse({ error: 'nope', error_code: 'forbidden' }, { ok: false, status: 403 }),
    )
    await expect(deleteCollection('c1')).rejects.toMatchObject({
      message: 'nope',
      status: 403,
      error_code: 'forbidden',
    })
    global.fetch.mockReturnValueOnce(jsonResponse({ error: 'missing' }, { ok: false, status: 404 }))
    await expect(fetchCollection('c1')).rejects.toMatchObject({
      message: 'missing',
      status: 404,
    })
  })

  test('searchGames stays on /api/search and slices the array', async () => {
    const rows = [
      { uuid: 'a', name: 'A' },
      { uuid: 'b', name: 'B' },
      { uuid: 'c', name: 'C' },
    ]
    global.fetch.mockReturnValue(jsonResponse(rows))
    await expect(searchGames('  cel  ', { limit: 2 })).resolves.toEqual(rows.slice(0, 2))
    expect(global.fetch.mock.calls[0][0]).toBe('/api/search?query=cel')
    await expect(searchGames('   ')).resolves.toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
