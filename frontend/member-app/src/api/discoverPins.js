import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

/** Rows this member keeps at the top of their Discover feed. */
export async function fetchDiscoverPins({ signal } = {}) {
  const response = await fetch('/api/discover/pins', {
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'discover pins')
  }
  const data = await response.json()
  return {
    pins: Array.isArray(data.pins) ? data.pins : [],
    maxPins: Number(data.max_pins) || 0,
    available: Array.isArray(data.available) ? data.available : [],
  }
}

/**
 * Replace the pinned rows.
 *
 * The whole list is sent rather than one identifier, because order is part of
 * what a member is choosing — a "pin this" that could not express "and put it
 * second" would need a second call to say the same thing.
 */
export async function saveDiscoverPins(pins, { signal } = {}) {
  const response = await fetch('/api/discover/pins', {
    method: 'PUT',
    credentials: 'same-origin',
    signal,
    headers: csrfHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify({ pins }),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'save discover pins')
  }
  const data = await response.json()
  return {
    pins: Array.isArray(data.pins) ? data.pins : [],
    maxPins: Number(data.max_pins) || 0,
  }
}
