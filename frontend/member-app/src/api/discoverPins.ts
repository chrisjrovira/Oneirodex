import { createDiscoverApi } from '@oneirodex/api-client'

import { memberResource, withMemberError } from './client'

const discover = memberResource(createDiscoverApi)

type PinArrangement = { pins?: string[]; hidden?: string[] }

function shape(data: {
  pins?: unknown
  hidden?: unknown
  max_pins?: unknown
  available?: unknown
}) {
  return {
    pins: Array.isArray(data.pins) ? (data.pins as string[]) : [],
    hidden: Array.isArray(data.hidden) ? (data.hidden as string[]) : [],
    maxPins: Number(data.max_pins) || 0,
    available: Array.isArray(data.available) ? (data.available as string[]) : [],
  }
}

/**
 * How this member has arranged their Discover feed.
 *
 * `pins` are the rows held at the top, in the member's order; `hidden` are the
 * rows kept off the feed entirely. One request, because they are one
 * arrangement — see the route's docstring.
 */
export async function fetchDiscoverPins({ signal }: { signal?: AbortSignal } = {}) {
  return shape(await withMemberError(discover.getPins(signal), 'discover pins'))
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
 * A bare array is read as `pins`, which is how every existing caller uses this.
 */
export async function saveDiscoverPins(
  arrangement: PinArrangement | string[] | null | undefined,
  { signal }: { signal?: AbortSignal } = {},
) {
  const body: PinArrangement = Array.isArray(arrangement)
    ? { pins: arrangement }
    : arrangement || {}
  const { available: _unused, ...rest } = shape(
    await withMemberError(discover.setPins(body, signal), 'save discover pins'),
  )
  return rest
}
