import { describe, expect, it } from 'vitest'
import { harness } from './test-harness.js'

describe('game api', () => {
  it('details hits GET /api/games/{uuid}/details', async () => {
    const { calls, client } = harness(200, { uuid: 'g1', name: 'Ico' })
    const res = await client.game.details('g1')
    expect(calls[0].url).toBe('https://host.example/api/games/g1/details')
    expect(res.name).toBe('Ico')
  })

  it('details on a hidden game rejects with error_code forbidden', async () => {
    const { client } = harness(403, { ok: false, error: 'Forbidden', error_code: 'forbidden' })
    await expect(client.game.details('g9')).rejects.toMatchObject({
      status: 403,
      error_code: 'forbidden',
    })
  })
})
