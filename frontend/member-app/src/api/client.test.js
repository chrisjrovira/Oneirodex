import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { deleteJson, getJson, patchJson, postJson, send, sendResult } from './client'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return Promise.resolve({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(payload),
  })
}

describe('member browser-transport verbs', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf-token">'
    global.fetch = vi.fn(() => jsonResponse({ ok: true }))
  })

  afterEach(() => {
    document.head.innerHTML = ''
    delete global.fetch
  })

  test('getJson returns JSON over credentials include', async () => {
    global.fetch.mockReturnValue(jsonResponse({ collections: [] }))
    await expect(getJson('/api/collections', { label: 'collections' })).resolves.toEqual({
      collections: [],
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/collections',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('maps an envelope failure onto errorFromBody', async () => {
    global.fetch.mockReturnValue(
      jsonResponse({ error: 'nope', error_code: 'forbidden' }, { ok: false, status: 403 }),
    )
    await expect(getJson('/api/requests', { label: 'requests' })).rejects.toMatchObject({
      message: 'nope',
      status: 403,
      error_code: 'forbidden',
    })
  })

  test('mutating verbs send the CSRF token', async () => {
    await postJson('/api/requests', { title: 'X' }, { label: 'create request' })
    const [, init] = global.fetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('X-CSRFToken')).toBe('test-csrf-token')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  test('patchJson and deleteJson keep method and CSRF', async () => {
    await patchJson('/api/requests/7', { status: 'fulfilled' }, { label: 'resolve request' })
    await deleteJson('/api/requests/7', undefined, { label: 'delete request' })
    const patchCall = global.fetch.mock.calls.find((call) => call[1]?.method === 'PATCH')
    const deleteCall = global.fetch.mock.calls.find((call) => call[1]?.method === 'DELETE')
    expect(patchCall[0]).toBe('/api/requests/7')
    expect(new Headers(patchCall[1].headers).get('X-CSRFToken')).toBe('test-csrf-token')
    expect(deleteCall[0]).toBe('/api/requests/7')
    expect(new Headers(deleteCall[1].headers).get('X-CSRFToken')).toBe('test-csrf-token')
  })

  test('send posts FormData without a JSON content type', async () => {
    const body = new FormData()
    body.append('file', new Blob(['x']), 'cheat.cht')
    await send('/api/games/g1/cheats', { method: 'POST', body, label: 'cheat upload' })
    const [, init] = global.fetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(body)
    expect(new Headers(init.headers).get('X-CSRFToken')).toBe('test-csrf-token')
    expect(new Headers(init.headers).get('Content-Type')).toBeNull()
  })

  test('sendResult returns ok/status/data on 4xx without throwing', async () => {
    global.fetch.mockReturnValue(jsonResponse({ error: 'missing' }, { ok: false, status: 404 }))
    await expect(sendResult('/api/games/batch/favorite', { method: 'POST' })).resolves.toEqual({
      ok: false,
      status: 404,
      data: { error: 'missing' },
    })
  })
})
