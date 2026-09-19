/** The browse result as LibraryApp and its hooks read it (H-D.2). */

export interface LibraryGame {
  uuid: string
  is_favorite?: boolean
  play_status?: string | null
  freshness_status?: string | null
  freshness_confidence?: number | null
  [key: string]: unknown
}

export interface BrowseResult {
  games: LibraryGame[]
  pages?: number
  total?: number
  [key: string]: unknown
}

/** A row from a batch endpoint: which uuid, and why it was skipped if it was. */
export interface BatchRow {
  uuid?: string
  reason?: string
  [key: string]: unknown
}

export function errorMessage(err: unknown): string | undefined {
  return typeof err === 'object' && err && 'message' in err
    ? String((err as { message?: unknown }).message || '')
    : undefined
}
