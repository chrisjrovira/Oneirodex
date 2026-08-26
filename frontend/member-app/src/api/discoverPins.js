import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

/**
 * How this member has arranged their Discover feed.
 *
 * `pins` are the rows held at the top, in the member's order; `hidden` are the
 * rows kept off the feed entirely. One request, because they are one
 * arrangement — see the route's docstring.
 */
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
    hidden: Array.isArray(data.hidden) ? data.hidden : [],
    maxPins: Number(data.max_pins) || 0,
    available: Array.isArray(data.available) ? data.available : [],
  }
}

/**
 * Replace the pinned rows, the hidden rows, or both.
 *
 * The whole list is sent rather than one identifier, because order is part of
 * what a member is choosing — a "pin this" that could not express "and put it
 * second" would need a second call to say the same thing. Reordering pins is
 * the same call as adding one.
 *
 * Either half may be omitted; the server leaves out what it is not sent, so a
 * control that only hides a row does not have to know the current pins.
 *
 * @param {{pins?: string[], hidden?: string[]}|string[]} arrangement A bare
 *   array is read as `pins`, which is how every existing caller uses this.
 */
export async function saveDiscoverPins(arrangement, { signal } = {}) {
  const body = Array.isArray(arrangement) ? { pins: arrangement } : arrangement || {}
  const response = await fetch('/api/discover/pins', {
    method: 'PUT',
    credentials: 'same-origin',
    signal,
    headers: csrfHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'save discover pins')
  }
  const data = await response.json()
  return {
    pins: Array.isArray(data.pins) ? data.pins : [],
    hidden: Array.isArray(data.hidden) ? data.hidden : [],
    maxPins: Number(data.max_pins) || 0,
  }
}
