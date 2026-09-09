import { describe, expect, it } from 'vitest'
import { harness } from './test-harness.js'

describe('collections api', () => {
  it('create POSTs JSON to /api/collections', async () => {
    const { calls, client } = harness(201, { uuid: 'c1', name: 'Co-op night' })
    const res = await client.collections.create({ name: 'Co-op night' })
    expect(calls[0]).toMatchObject({ url: 'https://host.example/api/collections', method: 'POST' })
    expect(calls[0].headers.get('Content-Type')).toBe('application/json')
    expect(res.uuid).toBe('c1')
  })

  it('reorderItems PUTs { game_uuids } and surfaces a 400', async () => {
    const { calls, client } = harness(400, {
      ok: false,
      error: 'game_uuids must list each collection item exactly once',
      error_code: 'bad_request',
    })
    await expect(client.collections.reorderItems('c1', ['a', 'b'])).rejects.toMatchObject({
      status: 400,
      error_code: 'bad_request',
    })
    expect(calls[0].url).toBe('https://host.example/api/collections/c1/items/order')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ game_uuids: ['a', 'b'] })
  })
})
