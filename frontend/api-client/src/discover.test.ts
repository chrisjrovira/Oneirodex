import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('discover api', () => {
  it('row builds the offset/limit/feed_token query', async () => {
    const { calls, client } = harness(200, okEnvelope({ identifier: 'new-arrivals', games: [] }))
    await client.discover.row('new-arrivals', { offset: 20, limit: 10, feedToken: 'tok' })
    expect(calls[0].url).toBe(
      'https://host.example/api/discover/rows/new-arrivals?offset=20&limit=10&feed_token=tok',
    )
  })

  it('unknown row rejects 404 not_found', async () => {
    const { client } = harness(404, {
      ok: false,
      error: 'That Discover row is not available.',
      error_code: 'not_found',
      detail: 'nope',
    })
    await expect(client.discover.row('nope')).rejects.toMatchObject({
      status: 404,
      error_code: 'not_found',
    })
  })
})
