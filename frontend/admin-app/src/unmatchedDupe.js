/**
 * Wave 17 unmatched / dupe helpers — shared by DupeGlance (+ vitest).
 * Soft: prefer list `matched_game` / `duplicate_of`; flat matched_game_* OK.
 * W22 dupe side-by-side: soft-read size/date when Backend adds them; never invent.
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

/** Soft size bytes from row / matched_game (null when API omits). */
export function pickDiskSizeBytes(source) {
  if (!source || typeof source !== 'object') return null
  const keys = ['size_bytes', 'folder_size_bytes', 'folder_size', 'size']
  for (const key of keys) {
    if (source[key] == null || source[key] === '') continue
    const n = Number(source[key])
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

/** Soft mtime / date from row / matched_game (null when API omits). */
export function pickDiskDate(source) {
  if (!source || typeof source !== 'object') return null
  const keys = [
    'mtime',
    'folder_mtime',
    'modified_at',
    'date_modified',
    'failed_time',
    'date_identified',
    'date_created',
  ]
  for (const key of keys) {
    if (source[key] == null || source[key] === '') continue
    const raw = source[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      // Heuristic: seconds vs ms epoch
      const ms = raw < 1e12 ? raw * 1000 : raw
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
      continue
    }
    const text = String(raw).trim()
    if (!text) continue
    const parsed = Date.parse(text)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    // Keep opaque API strings (already ISO-ish) for display
    return text
  }
  return null
}

/** Human size for compare cells; null → caller shows empty state. */
export function formatByteSize(bytes) {
  if (bytes == null || bytes === '') return null
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return null
  if (n < 1024) return `${Math.round(n)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/** Locale date for compare cells; null → caller shows empty state. */
export function formatDiskDate(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed))
  } catch {
    return new Date(parsed).toISOString()
  }
}

/**
 * Normalize library hit for “Dupe of …” / side-by-side compare.
 * @returns {{
 *   uuid: string|null,
 *   name: string,
 *   path: string,
 *   cover_url: string|null,
 *   match_score: unknown,
 *   size_bytes: number|null,
 *   mtime: string|null,
 * } | null}
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
      size_bytes: pickDiskSizeBytes(nested),
      mtime: pickDiskDate(nested),
    }
  }
  const flatName =
    (folder.matched_game_name != null && String(folder.matched_game_name).trim()) || ''
  const flatPath =
    (folder.matched_game_path != null && String(folder.matched_game_path).trim()) || ''
  const flatUuid = folder.matched_game_uuid || null
  // uuid alone is not enough — leave null so callers soft-enrich from /duplicates
  if (!flatName && !flatPath) return null
  const flatSize = pickDiskSizeBytes({
    size_bytes: folder.matched_game_size_bytes,
    size: folder.matched_game_size,
    folder_size_bytes: folder.matched_game_folder_size_bytes,
  })
  const flatDate = pickDiskDate({
    mtime: folder.matched_game_mtime,
    folder_mtime: folder.matched_game_folder_mtime,
    modified_at: folder.matched_game_modified_at,
    date_identified: folder.matched_game_date_identified,
    date_created: folder.matched_game_date_created,
  })
  return {
    uuid: flatUuid || null,
    name: flatName || 'Library game',
    path: flatPath,
    cover_url: folder.matched_game_cover_url || null,
    match_score: folder.match_score,
    size_bytes: flatSize,
    mtime: flatDate,
  }
}

/**
 * Two sides for Duplicate trail compare (folder vs library hit).
 * Size/date may be null until Backend enriches list/`matched_game`.
 * @returns {{ folder: object, library: object|null } | null}
 */
export function buildDupeCompare(folder) {
  if (!folder || typeof folder !== 'object') return null
  const hit = normalizeMatchedGame(folder)
  const isDuplicate = folder.status === 'Duplicate'
  if (!hit && !isDuplicate) return null

  const folderSide = {
    role: 'folder',
    label: 'This folder',
    name: resolveSearchName(folder) || folderBasename(folder.folder_path) || 'Folder',
    path: folder.folder_path ? String(folder.folder_path) : '',
    size_bytes: pickDiskSizeBytes(folder),
    mtime: pickDiskDate(folder),
    cover_url: null,
    uuid: null,
  }

  const librarySide = hit
    ? {
        role: 'library',
        label: 'Library game',
        name: hit.name,
        path: hit.path || '',
        size_bytes: hit.size_bytes,
        mtime: hit.mtime,
        cover_url: hit.cover_url,
        uuid: hit.uuid,
        match_score: hit.match_score,
      }
    : null

  return { folder: folderSide, library: librarySide }
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
      size_bytes: pickDiskSizeBytes(cand),
      mtime: pickDiskDate(cand),
      size: cand.size,
      folder_size_bytes: cand.folder_size_bytes,
      folder_mtime: cand.folder_mtime,
      modified_at: cand.modified_at,
      date_identified: cand.date_identified,
      date_created: cand.date_created,
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
