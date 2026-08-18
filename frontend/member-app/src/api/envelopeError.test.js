import { describe, expect, test } from 'vitest'

import { errorFromBody, errorFromResponse } from './envelopeError'

/** Minimal stand-in for a failed fetch Response. */
function failed(status, body) {
  return {
    ok: false,
    status,
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input')
      }
      return body
    },
  }
}

describe('errorFromResponse', () => {
  test('prefers the envelope sentence over the developer string', async () => {
    const error = await errorFromResponse(
      failed(403, { ok: false, error: 'Free games are switched off', error_code: 'forbidden' }),
      'free games',
    )
    expect(error.message).toBe('Free games are switched off')
  })

  test('keeps the machine fields PageStatus renders as the detail line', async () => {
    const error = await errorFromResponse(
      failed(404, { ok: false, error: 'Offer not found', error_code: 'not_found' }),
      'claim assist',
    )
    expect(error.status).toBe(404)
    expect(error.error_code).toBe('not_found')
  })

  test('falls back to the label and status when the body has no sentence', async () => {
    const error = await errorFromResponse(failed(500, { ok: false }), 'announcements')
    expect(error.message).toBe('announcements 500')
  })

  test('survives a response with no JSON body at all', async () => {
    const error = await errorFromResponse(failed(502), 'downloads')
    expect(error.message).toBe('downloads 502')
    expect(error.status).toBe(502)
    expect(error.error_code).toBeUndefined()
  })

  test('a blank or whitespace sentence does not become the headline', async () => {
    const error = await errorFromResponse(failed(400, { ok: false, error: '   ' }), 'wishlist')
    expect(error.message).toBe('wishlist 400')
  })

  test('omits error_code when the backend did not send one', async () => {
    const error = await errorFromResponse(failed(400, { error: 'Legacy shape' }), 'legacy')
    expect(error.message).toBe('Legacy shape')
    expect(error.error_code).toBeUndefined()
  })

  test('does not throw when the body was already consumed', async () => {
    // Some wrappers need the parsed body on the success path, so they read it
    // first. Reading twice rejects; the fallback label has to survive that.
    const response = failed(500, { error: 'never seen' })
    await response.json()
    response.json = async () => {
      throw new TypeError('body stream already read')
    }
    const error = await errorFromResponse(response, 'batch favorite')
    expect(error.message).toBe('batch favorite 500')
    expect(error.status).toBe(500)
  })
})

describe('errorFromBody', () => {
  test('produces the same shape from an already-read body', () => {
    const error = errorFromBody(
      { ok: false, error: 'Offer not found', error_code: 'not_found' },
      404,
      'claim assist',
    )
    expect(error.message).toBe('Offer not found')
    expect(error.status).toBe(404)
    expect(error.error_code).toBe('not_found')
    expect(error.data).toEqual({ ok: false, error: 'Offer not found', error_code: 'not_found' })
  })

  test('falls back to the label when the body has no sentence', () => {
    expect(errorFromBody({}, 502, 'batch status').message).toBe('batch status 502')
  })

  test('tolerates a null body', () => {
    const error = errorFromBody(null, 500, 'client/commands')
    expect(error.message).toBe('client/commands 500')
    expect(error.data).toBeUndefined()
  })
})
