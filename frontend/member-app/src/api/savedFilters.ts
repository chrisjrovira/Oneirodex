/** Named filters and the nested tree behind them (INSP-3). */
import { deleteJson, getJson, postJson, putJson } from './client'

/** A group combines its children; a leaf names one field. */
export type FilterNode = FilterGroup | FilterLeaf

export interface FilterGroup {
  op: 'and' | 'or' | 'not'
  nodes: FilterNode[]
}

export interface FilterLeaf {
  field: string
  value: boolean | string | string[]
}

export function isGroup(node: FilterNode): node is FilterGroup {
  return (node as FilterGroup).op !== undefined
}

/**
 * What a builder may offer.
 *
 * Served from the backend's own field registry rather than duplicated here:
 * the tree can only name fields the chip row already offers, and a second copy
 * of that list in the SPA is a copy that goes stale the day a field is added.
 */
export interface FilterField {
  field: string
  kind: 'flag' | 'enum' | 'enum_list' | 'text'
  values?: string[]
}

export interface SavedFilter {
  id: number
  name: string
  tree: FilterNode
  is_collection: boolean
  created: string | null
  updated: string | null
}

export interface FilterPreview {
  count: number
  sample: { uuid: string; name: string }[]
}

/**
 * A tree the server will not run, with the part that is wrong.
 *
 * `path` is dotted from the root (`root.1.0`), which is what lets the builder
 * mark the offending row instead of putting "invalid filter" above a form with
 * fifteen of them.
 */
export class FilterTreeRejected extends Error {
  path: string

  constructor(message: string, path: string) {
    super(message)
    this.name = 'FilterTreeRejected'
    this.path = path
  }
}

function rethrowTreeError(error: unknown): never {
  // `errorFromBody` hangs the whole envelope off `.data`, so the path the
  // server named for the offending node arrives there rather than on the error.
  const detail = (error as { data?: { detail?: { path?: string } } })?.data?.detail
  if (detail && typeof detail.path === 'string') {
    throw new FilterTreeRejected((error as Error).message, detail.path)
  }
  throw error
}

export async function fetchFilterFields(signal?: AbortSignal): Promise<FilterField[]> {
  const data = await getJson('/api/filters/fields', { signal, label: '/api/filters/fields' })
  return Array.isArray(data.fields) ? data.fields : []
}

export async function fetchSavedFilters(signal?: AbortSignal): Promise<SavedFilter[]> {
  const data = await getJson('/api/filters/saved', { signal, label: '/api/filters/saved' })
  return Array.isArray(data.filters) ? data.filters : []
}

export async function createSavedFilter(
  name: string,
  tree: FilterNode,
  isCollection = false,
): Promise<SavedFilter> {
  try {
    const data = await postJson('/api/filters/saved', {
      name,
      tree,
      is_collection: isCollection,
    })
    return data.filter
  } catch (error) {
    rethrowTreeError(error)
  }
}

export async function updateSavedFilter(
  id: number,
  patch: { name?: string; tree?: FilterNode; is_collection?: boolean },
): Promise<SavedFilter> {
  try {
    const data = await putJson(`/api/filters/saved/${id}`, patch)
    return data.filter
  } catch (error) {
    rethrowTreeError(error)
  }
}

export async function deleteSavedFilter(id: number): Promise<void> {
  await deleteJson(`/api/filters/saved/${id}`)
}

/** How many titles this tree matches, counted through the member's own access. */
export async function previewFilter(tree: FilterNode, limit = 0): Promise<FilterPreview> {
  try {
    const data = await postJson('/api/filters/preview', { tree, limit })
    return { count: data.count ?? 0, sample: Array.isArray(data.sample) ? data.sample : [] }
  } catch (error) {
    rethrowTreeError(error)
  }
}
