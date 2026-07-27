import type { GamethecaClient, SearchResultItem } from '@gametheca/api-client'
import { GamethecaApiError } from '@gametheca/api-client'

import type { LifecycleRegistry } from './lifecycle.js'

export interface ConnectionValidation {
  ok: true
  collectionCount: number
}

export interface ConnectionFailure {
  ok: false
  message: string
}

export type ConnectionResult = ConnectionValidation | ConnectionFailure

/** Maps API / runtime failures to short companion status copy. */
export function formatDesktopApiError(error: unknown): string {
  if (error instanceof GamethecaApiError) {
    switch (error.status) {
      case 401:
        return 'Invalid token or unauthorized (401).'
      case 403:
        return 'Token lacks required scope (403). Need read:library; write:download for installs.'
      case 404:
        return 'Server URL looks wrong (404). Check the base URL.'
      case 429:
        return 'Too many requests (429). Wait a moment and retry.'
      default:
        return error.message || `HTTP ${error.status}`
    }
  }
  if (error instanceof Error) {
    const msg = error.message
    if (/not allowed|permission|denied|capability/i.test(msg)) {
      return `Companion permission error: ${msg}`
    }
    if (/ENOENT|no such file|not found/i.test(msg)) {
      return `Local file missing: ${msg}`
    }
    return msg
  }
  return 'Connection failed'
}

/** Validates credentials by listing collections (lightweight authenticated call). */
export async function validateConnection(api: GamethecaClient): Promise<ConnectionResult> {
  try {
    const collections = await api.browse.listCollections()
    return { ok: true, collectionCount: collections.length }
  } catch (error) {
    return { ok: false, message: formatDesktopApiError(error) }
  }
}

function extractSearchResults(response: {
  results?: SearchResultItem[]
  games?: SearchResultItem[]
}): SearchResultItem[] {
  return response.results ?? response.games ?? []
}

/** Fetches a small slice of the library via search (fallback queries if empty). */
export async function fetchLibraryPreview(
  api: GamethecaClient,
  limit = 12,
): Promise<SearchResultItem[]> {
  const queries = ['', '*', 'a']
  for (const query of queries) {
    try {
      const response = await api.browse.search({ query })
      const items = extractSearchResults(response)
      if (items.length > 0) {
        return items.slice(0, limit)
      }
    } catch {
      // try next query shape
    }
  }
  return []
}

/**
 * When local state is installed but search marks an update, flip to update_available.
 * Returns how many games were signaled.
 */
export function mergeUpdateSignalsFromLibrary(
  registry: LifecycleRegistry,
  games: SearchResultItem[],
): number {
  let signaled = 0
  for (const game of games) {
    const uuid = typeof game.uuid === 'string' ? game.uuid : ''
    if (!uuid || registry.get(uuid) !== 'installed') {
      continue
    }
    const hasUpdates = game.has_updates === true
    const lifecycle = game.lifecycle_state
    if (hasUpdates || lifecycle === 'update_available') {
      registry.signalUpdateAvailable(uuid)
      signaled += 1
    }
  }
  return signaled
}
