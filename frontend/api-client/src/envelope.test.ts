import { describe, expect, it } from 'vitest'
import { createRequester, OneirodexApiError } from './client.js'
import { isApiError, type ApiErrorEnvelope, type ApiOk } from './types.js'

describe('isApiError', () => {
  it('accepts a real failure envelope', () => {
    const body: unknown = {
      ok: false,
      error: 'Not found',
      error_code: 'not_found',
      message: 'Not found',
    }
    expect(isApiError(body)).toBe(true)
    if (isApiError(body)) {
      // Narrowed to ApiErrorEnvelope here.
      expect(body.error_code).toBe('not_found')
    }
  })

  it('rejects a success envelope', () => {
    const body: ApiOk<{ collections: string[] }> = {
      ok: true,
      error: null,
      error_code: null,
      collections: [],
    }
    expect(isApiError(body)).toBe(false)
  })

  it('rejects arbitrary / malformed JSON', () => {
    expect(isApiError(null)).toBe(false)
    expect(isApiError('nope')).toBe(false)
    expect(isApiError({ ok: false })).toBe(false) // no error string
    expect(isApiError({ error: 'x' })).toBe(false) // no ok:false discriminant
  })
})

describe('requester + envelope end to end', () => {
  const jsonResponse = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  it('a caught OneirodexApiError.body is an ApiErrorEnvelope that isApiError narrows', async () => {
    const request = createRequester({
      baseUrl: 'https://host.example',
      getToken: () => null,
      fetchImpl: async () =>
        jsonResponse(422, {
          ok: false,
          error: 'Validation failed',
          error_code: 'unprocessable',
          detail: { name: 'required' },
        }),
    })

    try {
      await request('/api/thing', { method: 'POST' })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(OneirodexApiError)
      const apiErr = err as OneirodexApiError
      expect(apiErr.error_code).toBe('unprocessable')
      expect(isApiError(apiErr.body)).toBe(true)
      const envelope = apiErr.body as ApiErrorEnvelope
      expect(envelope.detail).toEqual({ name: 'required' })
    }
  })

  it('a success body is returned as T, not wrapped', async () => {
    const request = createRequester({
      baseUrl: 'https://host.example',
      getToken: () => null,
      fetchImpl: async () =>
        jsonResponse(200, { ok: true, error: null, error_code: null, total_seconds: 42 }),
    })

    const body = await request<ApiOk<{ total_seconds: number }>>('/api/playtime/me')
    expect(body.total_seconds).toBe(42)
    expect(isApiError(body)).toBe(false)
  })
})
