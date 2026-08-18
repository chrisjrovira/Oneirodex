import { errorFromBody } from './envelopeError'
import { csrfHeaders } from './csrf'
import { toggleFavorite as defaultToggleFavorite } from './userActions.js'

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { response, data }
}

export const BATCH_FAVORITE_URL = '/api/games/batch/favorite'
export const BATCH_FRESHNESS_URL = '/api/games/batch/freshness/check'
export const BATCH_STATUS_URL = '/api/games/batch/status'
export const BATCH_WISHLIST_URL = '/api/games/batch/wishlist'
export const BATCH_REFRESH_IMAGES_URL = '/api/games/batch/refresh_images'
/** Max uuids accepted by `POST /api/games/batch/refresh_images` (librarian+). */
export const BATCH_REFRESH_IMAGES_MAX = 20

/** Play-status values accepted by `POST /api/games/batch/status` (empty = clear). */
export const BATCH_PLAY_STATUS_OPTIONS = [
  { value: 'unplayed', label: 'Unplayed' },
  { value: 'unfinished', label: 'Unfinished' },
  { value: 'beaten', label: 'Beaten' },
  { value: 'completed', label: 'Completed' },
  { value: '', label: 'Clear' },
]

/**
 * Prefer Backend bulk favorite; if the route is missing, fall back to
 * per-game toggle_favorite only for titles whose state needs to change.
 *
 * @param {string[]} uuids
 * @param {boolean} favorite
 * @param {{ favoriteByUuid?: Record<string, boolean>, toggleFavorite?: (uuid: string) => Promise<{ is_favorite?: boolean }> }} [options]
 */
export async function batchSetFavorite(uuids, favorite, options = {}) {
  const list = Array.from(new Set((uuids || []).filter(Boolean)))
  if (list.length === 0) {
    return { ok: true, updated: [], skipped: [], errors: [], mode: 'noop' }
  }

  const { response, data } = await postJson(BATCH_FAVORITE_URL, {
    uuids: list,
    favorite: Boolean(favorite),
  })

  if (response.ok) {
    return {
      ok: data.ok !== false,
      updated: data.updated || list,
      skipped: data.skipped || [],
      errors: data.errors || [],
      mode: 'bulk',
      ...data,
    }
  }

  if (response.status !== 404 && response.status !== 501) {
    const error = errorFromBody(data, response.status, 'batch favorite')
    error.payload = data
    throw error
  }

  const toggleFavorite = options.toggleFavorite || defaultToggleFavorite
  const favoriteByUuid = options.favoriteByUuid || {}
  const updated = []
  const skipped = []
  const errors = []

  for (const uuid of list) {
    const current = Boolean(favoriteByUuid[uuid])
    if (current === Boolean(favorite)) {
      skipped.push(uuid)
      continue
    }
    try {
      const result = await toggleFavorite(uuid)
      if (Boolean(result?.is_favorite) === Boolean(favorite)) {
        updated.push(uuid)
      } else {
        // Toggle flipped the wrong way (race) — try once more.
        const again = await toggleFavorite(uuid)
        if (Boolean(again?.is_favorite) === Boolean(favorite)) {
          updated.push(uuid)
        } else {
          errors.push({ uuid, error: 'favorite state mismatch' })
        }
      }
    } catch (err) {
      errors.push({ uuid, error: err?.message || String(err) })
    }
  }

  return {
    ok: errors.length === 0,
    updated,
    skipped,
    errors,
    mode: 'fallback',
  }
}

/**
 * Call Backend bulk freshness check (`POST /api/games/batch/freshness/check`).
 * Missing/disabled route still throws with `unavailable` for callers that care.
 *
 * @param {string[]} uuids
 */
export async function batchCheckFreshness(uuids) {
  const list = Array.from(new Set((uuids || []).filter(Boolean)))
  if (list.length === 0) {
    return { ok: true, updated: [], skipped: [], errors: [], mode: 'noop' }
  }

  // The sticky bar always re-probes the selection; the API defaults to stale-only.
  const { response, data } = await postJson(BATCH_FRESHNESS_URL, {
    uuids: list,
    only_stale: false,
  })

  if (response.ok) {
    return {
      ok: data.ok !== false,
      updated: data.updated || [],
      skipped: data.skipped || [],
      errors: data.errors || [],
      mode: 'bulk',
      ...data,
    }
  }

  if (response.status === 404 || response.status === 501) {
    const error = new Error('Bulk freshness check is not available yet')
    error.status = response.status
    error.unavailable = true
    throw error
  }

  const error = errorFromBody(data, response.status, 'batch freshness')
  error.payload = data
  throw error
}

/**
 * Call Backend bulk play-status (`POST /api/games/batch/status`).
 * Missing/disabled route throws with `unavailable` so the sticky bar can disable.
 *
 * @param {string[]} uuids
 * @param {string} status — `unplayed` | `unfinished` | `beaten` | `completed` | ``
 */
export async function batchSetPlayStatus(uuids, status) {
  const list = Array.from(new Set((uuids || []).filter(Boolean)))
  const nextStatus = typeof status === 'string' ? status : ''
  if (list.length === 0) {
    return {
      ok: true,
      updated: [],
      skipped: [],
      errors: [],
      mode: 'noop',
      status: nextStatus || null,
    }
  }

  const { response, data } = await postJson(BATCH_STATUS_URL, {
    uuids: list,
    status: nextStatus,
  })

  if (response.ok) {
    return {
      ok: data.ok !== false,
      updated: data.updated || [],
      skipped: data.skipped || [],
      errors: data.errors || [],
      mode: 'bulk',
      ...data,
    }
  }

  if (response.status === 404 || response.status === 501) {
    const error = new Error('Bulk play status is not available yet')
    error.status = response.status
    error.unavailable = true
    throw error
  }

  const error = errorFromBody(data, response.status, 'batch status')
  error.payload = data
  throw error
}

/**
 * Call Backend bulk wishlist (`POST /api/games/batch/wishlist`).
 * Missing/disabled route throws with `unavailable` so the sticky bar can disable.
 *
 * @param {string[]} uuids
 */
export async function batchAddToWishlist(uuids) {
  const list = Array.from(new Set((uuids || []).filter(Boolean)))
  if (list.length === 0) {
    return { ok: true, updated: [], skipped: [], errors: [], mode: 'noop' }
  }

  const { response, data } = await postJson(BATCH_WISHLIST_URL, { uuids: list })

  if (response.ok) {
    return {
      ok: data.ok !== false,
      updated: data.updated || [],
      skipped: data.skipped || [],
      errors: data.errors || [],
      mode: 'bulk',
      ...data,
    }
  }

  if (response.status === 404 || response.status === 501) {
    const error = new Error('Bulk wishlist is not available yet')
    error.status = response.status
    error.unavailable = true
    throw error
  }

  const error = errorFromBody(data, response.status, 'batch wishlist')
  error.payload = data
  throw error
}

/**
 * Call Backend bulk cover refresh (`POST /api/games/batch/refresh_images`).
 * Expect 202 `{ ok, queued, skipped, errors }` (max 20). Missing route → `unavailable`.
 *
 * @param {string[]} uuids
 */
export async function batchRefreshImages(uuids) {
  const list = Array.from(new Set((uuids || []).filter(Boolean)))
  if (list.length === 0) {
    return { ok: true, queued: [], skipped: [], errors: [], mode: 'noop' }
  }

  if (list.length > BATCH_REFRESH_IMAGES_MAX) {
    const error = new Error(
      `Select at most ${BATCH_REFRESH_IMAGES_MAX} titles to refresh covers`,
    )
    error.status = 400
    error.limit = BATCH_REFRESH_IMAGES_MAX
    error.requested = list.length
    throw error
  }

  const { response, data } = await postJson(BATCH_REFRESH_IMAGES_URL, { uuids: list })

  if (response.ok || response.status === 202) {
    return {
      ok: data.ok !== false,
      queued: data.queued || [],
      skipped: data.skipped || [],
      errors: data.errors || [],
      mode: 'bulk',
      ...data,
    }
  }

  if (response.status === 404 || response.status === 501) {
    const error = new Error('Batch cover refresh is not available yet')
    error.status = response.status
    error.unavailable = true
    throw error
  }

  const error = errorFromBody(data, response.status, 'batch refresh images')
  error.payload = data
  throw error
}
