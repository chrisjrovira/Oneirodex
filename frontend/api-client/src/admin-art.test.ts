import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('admin art api', () => {
  it('generate POSTs the title/system and apply POSTs the resulting pack_id', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ pack_id: 'pack-1', preview_url: '/x.webp', files: ['tile.webp'] }),
    )

    const pack = await client.adminArt.generate({ title: 'Chrono Trigger', system: 'snes' })
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/art-studio/generate',
      method: 'POST',
    })
    expect(pack.pack_id).toBe('pack-1')

    await client.adminArt.apply({ pack_id: pack.pack_id!, mode: 'game', game_uuid: 'g-1' })
    expect(calls[1]).toMatchObject({
      url: 'https://host.example/admin/api/art-studio/apply',
      method: 'POST',
    })
    expect(JSON.parse(calls[1].body ?? '{}')).toEqual({
      pack_id: 'pack-1',
      mode: 'game',
      game_uuid: 'g-1',
    })
  })

  it('getStockCatalog / getSystemMarksLab build the expected GET URLs', async () => {
    const stock = harness(200, okEnvelope({ items: [] }))
    await stock.client.adminArt.getStockCatalog()
    expect(stock.calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/art-studio/stock',
      method: 'GET',
    })

    const lab = harness(200, okEnvelope({ prompt: 'nes bios screen' }))
    await lab.client.adminArt.getSystemMarksLab('bios-boot', 'nes')
    expect(lab.calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/art-studio/system-marks/lab?theme=bios-boot&platform=nes',
      method: 'GET',
    })
  })

  it('batchApplyCovers POSTs the policy body and rejects on a 502', async () => {
    const { calls, client } = harness(200, okEnvelope({ applied: 3, failed: 0, results: [] }))

    const res = await client.adminArt.batchApplyCovers({
      policy: 'best_available',
      missing_cover: true,
      limit_games: 25,
    })
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/covers/batch/apply',
      method: 'POST',
    })
    expect(res.applied).toBe(3)

    const failing = harness(502, {
      ok: false,
      error: 'Provider unreachable',
      error_code: 'bad_gateway',
    })
    await expect(
      failing.client.adminArt.batchApplyCovers({ policy: 'best_available' }),
    ).rejects.toMatchObject({ status: 502, error_code: 'bad_gateway' })
  })
})
