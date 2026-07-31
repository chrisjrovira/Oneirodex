import {
  BATCH_FAVORITE_URL,
  BATCH_FRESHNESS_URL,
  BATCH_REFRESH_IMAGES_MAX,
  BATCH_REFRESH_IMAGES_URL,
  BATCH_STATUS_URL,
  BATCH_WISHLIST_URL,
  batchAddToWishlist,
  batchCheckFreshness,
  batchRefreshImages,
  batchSetFavorite,
  batchSetPlayStatus,
} from './batchActions'

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

test('batchSetFavorite prefers bulk route', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse({ ok: true, updated: ['a', 'b'], skipped: [], errors: [] }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const result = await batchSetFavorite(['a', 'b'], true)

  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_FAVORITE_URL,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ uuids: ['a', 'b'], favorite: true }),
    }),
  )
  expect(result.mode).toBe('bulk')
  expect(result.updated).toEqual(['a', 'b'])
})

test('batchSetFavorite falls back to toggle when bulk missing', async () => {
  const fetchMock = vi.fn(() => jsonResponse({}, 404))
  vi.stubGlobal('fetch', fetchMock)
  const toggleFavorite = vi
    .fn()
    .mockResolvedValueOnce({ is_favorite: true })
    .mockResolvedValueOnce({ is_favorite: true })

  const result = await batchSetFavorite(['a', 'b'], true, {
    favoriteByUuid: { a: false, b: true },
    toggleFavorite,
  })

  expect(result.mode).toBe('fallback')
  expect(result.updated).toEqual(['a'])
  expect(result.skipped).toEqual(['b'])
  expect(toggleFavorite).toHaveBeenCalledTimes(1)
  expect(toggleFavorite).toHaveBeenCalledWith('a')
})

test('batchCheckFreshness marks missing route unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, 404)))

  await expect(batchCheckFreshness(['a'])).rejects.toMatchObject({
    unavailable: true,
    status: 404,
  })
})

test('batchCheckFreshness returns bulk payload when ready', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse({
      ok: true,
      updated: [{ uuid: 'a', status: 'current' }],
      skipped: [],
      errors: [],
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const result = await batchCheckFreshness(['a'])
  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_FRESHNESS_URL,
    expect.objectContaining({ method: 'POST' }),
  )
  expect(result.mode).toBe('bulk')
  expect(result.updated[0].uuid).toBe('a')
})

test('batchSetPlayStatus posts status payload', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse({
      ok: true,
      updated: [{ uuid: 'a', status: 'beaten' }],
      skipped: [],
      errors: [],
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const result = await batchSetPlayStatus(['a'], 'beaten')
  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_STATUS_URL,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ uuids: ['a'], status: 'beaten' }),
    }),
  )
  expect(result.mode).toBe('bulk')
  expect(result.updated[0].status).toBe('beaten')
})

test('batchSetPlayStatus marks missing route unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, 404)))

  await expect(batchSetPlayStatus(['a'], 'unplayed')).rejects.toMatchObject({
    unavailable: true,
    status: 404,
  })
})

test('batchSetPlayStatus clears with empty status', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse({ ok: true, updated: [{ uuid: 'a', status: null }], skipped: [], errors: [] }),
  )
  vi.stubGlobal('fetch', fetchMock)

  await batchSetPlayStatus(['a'], '')
  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_STATUS_URL,
    expect.objectContaining({
      body: JSON.stringify({ uuids: ['a'], status: '' }),
    }),
  )
})

test('batchAddToWishlist posts uuids', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse({
      ok: true,
      updated: [{ uuid: 'a', request_id: 1, title: 'Alpha' }],
      skipped: [],
      errors: [],
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const result = await batchAddToWishlist(['a', 'a'])
  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_WISHLIST_URL,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ uuids: ['a'] }),
    }),
  )
  expect(result.mode).toBe('bulk')
  expect(result.updated[0].request_id).toBe(1)
})

test('batchAddToWishlist marks missing route unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, 501)))

  await expect(batchAddToWishlist(['a'])).rejects.toMatchObject({
    unavailable: true,
    status: 501,
  })
})

test('batchRefreshImages posts uuids and accepts 202 queued payload', async () => {
  const fetchMock = vi.fn(() =>
    jsonResponse(
      {
        ok: true,
        queued: [{ uuid: 'a', status: 'queued' }],
        skipped: [{ uuid: 'b', reason: 'no_igdb_id' }],
        errors: [],
      },
      202,
    ),
  )
  vi.stubGlobal('fetch', fetchMock)

  const result = await batchRefreshImages(['a', 'b', 'a'])
  expect(fetchMock).toHaveBeenCalledWith(
    BATCH_REFRESH_IMAGES_URL,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ uuids: ['a', 'b'] }),
    }),
  )
  expect(result.mode).toBe('bulk')
  expect(result.queued).toHaveLength(1)
  expect(result.skipped).toHaveLength(1)
})

test('batchRefreshImages marks missing route unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, 404)))

  await expect(batchRefreshImages(['a'])).rejects.toMatchObject({
    unavailable: true,
    status: 404,
  })
})

test('batchRefreshImages rejects over max before fetch', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const uuids = Array.from({ length: BATCH_REFRESH_IMAGES_MAX + 1 }, (_, i) => `u${i}`)

  await expect(batchRefreshImages(uuids)).rejects.toMatchObject({
    status: 400,
    limit: BATCH_REFRESH_IMAGES_MAX,
  })
  expect(fetchMock).not.toHaveBeenCalled()
})
