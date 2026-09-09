import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('wishlist api', () => {
  it('setBatch POSTs { uuids, action } (action defaults to add)', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ updated: [], skipped: [], errors: [], limit: 50 }),
    )
    await client.wishlist.setBatch(['g1', 'g2'])
    expect(calls[0].url).toBe('https://host.example/api/games/batch/wishlist')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ uuids: ['g1', 'g2'], action: 'add' })
  })

  it('createRequest on a child account rejects 403 forbidden', async () => {
    const { client } = harness(403, {
      ok: false,
      error: 'Wishlist requests are not available for this account',
      error_code: 'forbidden',
    })
    await expect(client.wishlist.createRequest({ title: 'Katamari' })).rejects.toMatchObject({
      status: 403,
      error_code: 'forbidden',
    })
  })
})
