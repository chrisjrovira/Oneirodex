import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('account api', () => {
  it('changePassword POSTs the three fields', async () => {
    const { calls, client } = harness(200, okEnvelope({ changed: true }))
    await client.account.changePassword({
      current_password: 'a',
      new_password: 'bbbbbbbb',
      confirm_password: 'bbbbbbbb',
    })
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/account/password',
      method: 'POST',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toHaveProperty('new_password', 'bbbbbbbb')
  })

  it('wrong current password rejects 401 unauthorized', async () => {
    const { client } = harness(401, {
      ok: false,
      error: 'Current password is incorrect.',
      error_code: 'unauthorized',
    })
    await expect(
      client.account.changePassword({
        current_password: 'x',
        new_password: 'yyyyyyyy',
        confirm_password: 'yyyyyyyy',
      }),
    ).rejects.toMatchObject({ status: 401, error_code: 'unauthorized' })
  })

  it('uploadAvatar POSTs a multipart body with no forced JSON Content-Type', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ avatar_path: '/static/avatars/u1.webp', avatar_url: '/static/avatars/u1.webp' }),
    )

    const file = new File(['x'], 'me.png', { type: 'image/png' })
    const res = await client.account.uploadAvatar(file)

    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/account/avatar',
      method: 'POST',
    })
    // FormData isn't a string, so the harness records `body: null`; assert the
    // shape it actually cares about instead — no JSON Content-Type was forced.
    expect(calls[0].body).toBeNull()
    expect(calls[0].headers.get('content-type')).not.toBe('application/json')
    expect(res.avatar_path).toBe('/static/avatars/u1.webp')
  })

  it('uploadAvatar rejects with the envelope status + error_code on a 413', async () => {
    const { client } = harness(413, {
      ok: false,
      error: 'Image is too large.',
      error_code: 'payload_too_large',
    })
    const file = new File(['x'.repeat(10)], 'big.png', { type: 'image/png' })
    await expect(client.account.uploadAvatar(file)).rejects.toMatchObject({
      status: 413,
      error_code: 'payload_too_large',
    })
  })
})
