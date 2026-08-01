/**
 * Wave 17 unmatched / dupe helpers — shared by DupeGlance (+ vitest).
 * Soft: prefer list `matched_game` / `duplicate_of`; flat matched_game_* OK.
 */

export function folderBasename(path) {
  const parts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

/**
 * Soft Wave 17 naming: search_name → display_name → folder_name → basename.
 * Never implies a disk rename.
 */
export function resolveSearchName(folder) {
  if (!folder || typeof folder !== 'object') return ''
  const soft =
    (folder.search_name != null && String(folder.search_name).trim()) ||
    (folder.display_name != null && String(folder.display_name).trim()) ||
    ''
  if (soft) return soft
  if (folder.folder_name != null && String(folder.folder_name).trim()) {
    return String(folder.folder_name).trim()
  }
  return folderBasename(folder.folder_path)
}

/**
 * Normalize library hit for “Dupe of …” in base table / glance.
 * @returns {{ uuid: string|null, name: string, path: string, cover_url: string|null, match_score: unknown } | null}
 */
export function normalizeMatchedGame(folder) {
  if (!folder || typeof folder !== 'object') return null
  const nested = folder.matched_game || folder.duplicate_of
  if (nested && typeof nested === 'object') {
    const uuid = nested.uuid || nested.matched_game_uuid || null
    const name = String(nested.name || nested.title || '').trim()
    const path = nested.path || nested.full_disk_path || ''
    const cover = nested.cover_url || nested.cover || null
    if (!name && !uuid && !path) return null
    return {
      uuid: uuid || null,
      name: name || 'Library game',
      path: path || '',
      cover_url: cover || null,
      match_score: nested.match_score != null ? nested.match_score : folder.match_score,
    }
  }
  const flatName =
    (folder.matched_game_name != null && String(folder.matched_game_name).trim()) || ''
  const flatPath =
    (folder.matched_game_path != null && String(folder.matched_game_path).trim()) || ''
  const flatUuid = folder.matched_game_uuid || null
  // uuid alone is not enough — leave null so callers soft-enrich from /duplicates
  if (!flatName && !flatPath) return null
  return {
    uuid: flatUuid || null,
    name: flatName || 'Library game',
    path: flatPath,
    cover_url: folder.matched_game_cover_url || null,
    match_score: folder.match_score,
  }
}

/** Merge /duplicates candidates into list rows missing matched_game. */
export function mergeDuplicateHits(folders, duplicatesPayload) {
  const list = Array.isArray(folders) ? folders : []
  const byId = new Map()
  const dups = duplicatesPayload?.duplicates || duplicatesPayload || []
  ;(Array.isArray(dups) ? dups : []).forEach((dup) => {
    const cand = (dup.candidates && dup.candidates[0]) || null
    if (!cand) return
    byId.set(String(dup.id), {
      uuid: cand.uuid,
      name: cand.name,
      path: cand.path,
      cover_url: cand.cover_url,
      match_score: cand.match_score != null ? cand.match_score : dup.match_score,
      match_reason: cand.match_reason || dup.match_reason,
      transforms: Array.isArray(dup.transforms) ? dup.transforms : null,
    })
  })
  return list.map((folder) => {
    const hit = byId.get(String(folder.id))
    const folderHasTrail = Array.isArray(folder.transforms) && folder.transforms.length > 0
    const softTransforms =
      !folderHasTrail && hit?.transforms?.length ? hit.transforms : null
    if (normalizeMatchedGame(folder)) {
      if (!softTransforms) return folder
      return { ...folder, transforms: softTransforms }
    }
    if (!hit) return folder
    return {
      ...folder,
      matched_game: hit,
      match_score: folder.match_score != null ? folder.match_score : hit.match_score,
      match_reason: folder.match_reason || hit.match_reason,
      ...(softTransforms ? { transforms: softTransforms } : {}),
    }
  })
}
