import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('library tools api', () => {
  it('proposeLeafLibraries POSTs { root } and never claims auto_create', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({
        status: 'ok',
        root: '/storage/games',
        auto_create: false,
        count: 1,
        candidates: [{ path: '/storage/games/NES', platform: 'NES' }],
      }),
    )

    const res = await client.libraryTools.proposeLeafLibraries({ root: '/storage/games' })

    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/library_tools/propose_leaf_libraries',
      method: 'POST',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ root: '/storage/games' })
    expect(res.candidates?.[0].platform).toBe('NES')
    expect(res.auto_create).toBe(false)
  })

  it('importLeafLibrariesPreview sends JSON for a plain body, multipart for FormData', async () => {
    const jsonCall = harness(
      200,
      okEnvelope({ status: 'ok', auto_create: false, count: 0, candidates: [], errors: [] }),
    )
    await jsonCall.client.libraryTools.importLeafLibrariesPreview([{ path: '/x' }])
    expect(jsonCall.calls[0]).toMatchObject({
      url: 'https://host.example/api/library_tools/import_leaf_libraries/preview',
      method: 'POST',
    })
    expect(jsonCall.calls[0].headers.get('content-type')).toContain('application/json')

    const formCall = harness(
      200,
      okEnvelope({ status: 'ok', auto_create: false, count: 0, candidates: [], errors: [] }),
    )
    const form = new FormData()
    form.append('csv', 'path,platform\n/storage/games/Switch,SWITCH\n')
    await formCall.client.libraryTools.importLeafLibrariesPreview(form)
    // No JSON Content-Type forced on a FormData body — fetch sets its own
    // multipart boundary. The harness only records a `string` body, so a
    // FormData body reads back as `null` here.
    expect(formCall.calls[0].body).toBeNull()
    expect(formCall.calls[0].headers.get('content-type')).not.toBe('application/json')
  })

  it('rejects with the envelope status + error_code on a 404 (soft-degrade case)', async () => {
    const { client } = harness(404, {
      ok: false,
      error: 'Not available on this build yet',
      error_code: 'not_found',
    })

    await expect(
      client.libraryTools.proposeLeafLibraries({ root: '/storage/games' }),
    ).rejects.toMatchObject({ status: 404, error_code: 'not_found' })
  })
})
