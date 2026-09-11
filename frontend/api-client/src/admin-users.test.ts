import { describe, expect, it } from 'vitest'
import { harness, okEnvelope } from './test-harness.js'

describe('admin users api', () => {
  it('list GETs /admin/api/users', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ users: [{ id: 1, name: 'Ada', role: 'admin' }] }),
    )

    const res = await client.adminUsers.list()

    expect(calls[0]).toMatchObject({ url: 'https://host.example/admin/api/users', method: 'GET' })
    expect(res.users[0].name).toBe('Ada')
  })

  it('upsert PUTs to /admin/api/user/{id}, id 0 for create', async () => {
    const { calls, client } = harness(200, okEnvelope({ ok: true, error: null }))

    await client.adminUsers.upsert(0, {
      username: 'Guest',
      email: 'guest@example.invalid',
      password: 's3cret',
      role: 'user',
      state: true,
    })

    expect(calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/user/0',
      method: 'PUT',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({ username: 'Guest', role: 'user' })
  })

  it('listInviteQuotas GETs /admin/api/invites and surfaces a 403', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ users: [{ id: '1', name: 'Ada', unused_invites: 3 }] }),
    )
    const res = await client.adminUsers.listInviteQuotas()
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/admin/api/invites',
      method: 'GET',
    })
    expect(res.users[0].unused_invites).toBe(3)

    const forbidden = harness(403, {
      ok: false,
      error: 'Admin required',
      error_code: 'forbidden',
    })
    await expect(forbidden.client.adminUsers.list()).rejects.toMatchObject({
      status: 403,
      error_code: 'forbidden',
    })
  })
})
