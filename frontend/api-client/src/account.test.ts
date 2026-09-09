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
})
