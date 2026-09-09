import { describe, expect, it } from 'vitest'
import { OneirodexApiError } from './client.js'
import { harness, okEnvelope } from './test-harness.js'

describe('library api', () => {
  it('list hits GET /api/get_libraries', async () => {
    const { calls, client } = harness(200, okEnvelope({ libraries: [{ uuid: 'l1', name: 'PS2' }] }))
    const res = await client.library.list()
    expect(calls[0]).toMatchObject({ url: 'https://host.example/api/get_libraries', method: 'GET' })
    expect(res.libraries?.[0].uuid).toBe('l1')
  })

  it('setWatch PUTs { watch_enabled } and surfaces a 403', async () => {
    const { calls, client } = harness(403, {
      ok: false,
      error: 'Librarian or admin required',
      error_code: 'forbidden',
    })
    await expect(client.library.setWatch('l1', true)).rejects.toBeInstanceOf(OneirodexApiError)
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/library/l1/watch',
      method: 'PUT',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ watch_enabled: true })
  })
})
