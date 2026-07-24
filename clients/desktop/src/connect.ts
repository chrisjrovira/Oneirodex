import type { GamethecaClient, SearchResultItem } from '@gametheca/api-client'
import { GamethecaApiError } from '@gametheca/api-client'

export interface ConnectionValidation {
  ok: true
  collectionCount: number
}

export interface ConnectionFailure {
  ok: false
  message: string
}

export type ConnectionResult = ConnectionValidation | ConnectionFailure

function formatApiError(error: unknown): string {
  if (error instanceof GamethecaApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Connection failed'
}

/** Validates credentials by listing collections (lightweight authenticated call). */
export async function validateConnection(api: GamethecaClient): Promise<ConnectionResult> {
  try {
    const collections = await api.browse.listCollections()
    return { ok: true, collectionCount: collections.length }
  } catch (error) {
    return { ok: false, message: formatApiError(error) }
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
