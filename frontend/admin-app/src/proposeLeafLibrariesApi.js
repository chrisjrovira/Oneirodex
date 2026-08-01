/** Propose / import leaf libraries API helpers (preview-only; never auto-create). */

import { csrfToken, getJson, postJsonResult } from './adminApi'

export const PROPOSE_LEAF_URL = '/api/library_tools/propose_leaf_libraries'
export const IMPORT_LEAF_PREVIEW_URL = '/api/library_tools/import_leaf_libraries/preview'
export const LIBRARY_ADD_URL = '/admin/library/add'
export const LIBRARY_SCAN_URL = '/api/admin/libraries/scan'
export const GET_LIBRARIES_URL = '/api/get_libraries'

/**
 * Normalize one candidate row (propose or import preview).
 * @param {unknown} row
 * @param {number} index
 * @returns {object|null}
 */
export function normalizeCandidateRow(row, index) {
  if (!row || typeof row !== 'object') return null
  const path = String(row.path || '').trim()
  if (!path) return null
  const sourceIndex =
    typeof row.source_index === 'number' && Number.isFinite(row.source_index)
      ? row.source_index
      : index
  return {
    id: `${path}::${sourceIndex}`,
    path,
    suggested_name: String(row.suggested_name || row.name || path).trim() || path,
    platform: String(row.platform || 'OTHER').trim() || 'OTHER',
    scan_mode: row.scan_mode === 'files' ? 'files' : 'folders',
    scan_depth: Number(row.scan_depth) === 2 ? 2 : 1,
    reason: String(row.reason || '').trim(),
    source_index: sourceIndex,
  }
}

/**
 * Normalize propose API payload into a stable candidate list.
 * @param {unknown} data
 * @returns {{ root: string, candidates: object[], count: number, autoCreate: boolean }}
 */
export function normalizeProposeResponse(data) {
  if (!data || typeof data !== 'object') {
    return { root: '', candidates: [], count: 0, autoCreate: false }
  }
  const raw = Array.isArray(data.candidates) ? data.candidates : []
  const candidates = raw.map((row, index) => normalizeCandidateRow(row, index)).filter(Boolean)
  return {
    root: String(data.root || ''),
    candidates,
    count: typeof data.count === 'number' ? data.count : candidates.length,
    autoCreate: Boolean(data.auto_create),
  }
}

/**
 * Normalize import preview payload (candidates + errors; never creates).
 * @param {unknown} data
 * @returns {{
 *   candidates: object[],
 *   errors: object[],
 *   count: number,
 *   errorCount: number,
 *   autoCreate: boolean,
 *   createHint: string,
 * }}
 */
export function normalizeImportPreviewResponse(data) {
  if (!data || typeof data !== 'object') {
    return {
      candidates: [],
      errors: [],
      count: 0,
      errorCount: 0,
      autoCreate: false,
      createHint: '',
    }
  }
  const raw = Array.isArray(data.candidates) ? data.candidates : []
  const candidates = raw.map((row, index) => normalizeCandidateRow(row, index)).filter(Boolean)
  const errors = (Array.isArray(data.errors) ? data.errors : [])
    .filter((err) => err && typeof err === 'object')
    .map((err, index) => ({
      index: typeof err.index === 'number' ? err.index : null,
      path: err.path != null ? String(err.path) : null,
      code: String(err.code || '').trim(),
      message: String(err.message || err.error || '').trim() || 'Row rejected',
      id: `err-${err.index ?? index}-${err.code || 'unknown'}`,
    }))
  return {
    candidates,
    errors,
    count: typeof data.count === 'number' ? data.count : candidates.length,
    errorCount: typeof data.error_count === 'number' ? data.error_count : errors.length,
    autoCreate: Boolean(data.auto_create),
    createHint: String(data.create_hint || '').trim(),
  }
}

/**
 * Call propose API. Soft-degrades on 404 mid-rollout.
 * @param {string} root
 * @returns {Promise<{ unavailable?: boolean, error?: string, root?: string, candidates?: object[], count?: number }>}
 */
export async function fetchProposeLeafLibraries(root) {
  const trimmed = String(root || '').trim()
  if (!trimmed) {
    return { error: 'Enter a root path under an allowed base.' }
  }

  const response = await fetch(PROPOSE_LEAF_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify({ root: trimmed }),
  })

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }

  if (response.status === 404) {
    return {
      unavailable: true,
      error:
        'Propose leaf libraries API is not available on this build yet. Redeploy after the Backend W20-1 route lands.',
    }
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      error: data.message || data.error || `Propose failed (${response.status})`,
    }
  }

  const normalized = normalizeProposeResponse(data)
  if (normalized.autoCreate) {
    // Defense: UI never trusts an auto-create claim from older/buggy builds.
    return {
      error: 'Server reported auto_create — refusing. Propose must never create libraries.',
    }
  }
  return normalized
}

/**
 * Preview CSV/JSON leaf library import. Soft-degrades on 404; never creates.
 *
 * @param {{
 *   mode: 'json' | 'csv' | 'file',
 *   text?: string,
 *   file?: File | null,
 * }} opts
 * @returns {Promise<{
 *   unavailable?: boolean,
 *   error?: string,
 *   candidates?: object[],
 *   errors?: object[],
 *   count?: number,
 *   errorCount?: number,
 *   createHint?: string,
 * }>}
 */
export async function fetchImportLeafLibrariesPreview(opts) {
  const mode = opts?.mode || 'json'
  let response

  if (mode === 'file') {
    const file = opts?.file
    if (!file) {
      return { error: 'Choose a .json or .csv file to preview.' }
    }
    const form = new FormData()
    form.append('file', file, file.name || 'import.json')
    const name = String(file.name || '').toLowerCase()
    if (name.endsWith('.csv')) {
      form.append('format', 'csv')
    }
    response = await fetch(IMPORT_LEAF_PREVIEW_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
      body: form,
    })
  } else if (mode === 'csv') {
    const text = String(opts?.text || '')
    if (!text.trim()) {
      return { error: 'Paste CSV with a header row (path, platform, …).' }
    }
    const form = new FormData()
    form.append('csv', text)
    response = await fetch(IMPORT_LEAF_PREVIEW_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
      body: form,
    })
  } else {
    const text = String(opts?.text || '').trim()
    if (!text) {
      return { error: 'Paste a JSON array (or {candidates: […]}) to preview.' }
    }
    let body
    try {
      body = JSON.parse(text)
    } catch {
      return { error: 'Paste valid JSON (array or object with candidates/items/libraries/rows).' }
    }
    response = await fetch(IMPORT_LEAF_PREVIEW_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken(),
      },
      body: JSON.stringify(body),
    })
  }

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }

  if (response.status === 404) {
    return {
      unavailable: true,
      error:
        'Import leaf libraries preview API is not available on this build yet. Redeploy after the Backend W20-1b route lands.',
    }
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      error: data.message || data.error || `Import preview failed (${response.status})`,
    }
  }

  const normalized = normalizeImportPreviewResponse(data)
  if (normalized.autoCreate) {
    return {
      error: 'Server reported auto_create — refusing. Import preview must never create libraries.',
    }
  }
  return normalized
}

/**
 * Create one library via existing form POST (name / platform / scan_depth).
 * @param {{ suggested_name: string, platform: string, scan_depth: number }} candidate
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function createLibraryFromCandidate(candidate) {
  const form = new FormData()
  form.append('csrf_token', csrfToken())
  form.append('name', candidate.suggested_name)
  form.append('platform', candidate.platform || 'OTHER')
  form.append('scan_depth', String(candidate.scan_depth || 1))
  form.append('watch_enabled', 'default')

  const response = await fetch(LIBRARY_ADD_URL, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }

  // Success redirects away from /admin/library/add; validation errors re-render the form.
  const landedOnAdd = String(response.url || '').includes('/admin/library/add')
  if (response.ok && !landedOnAdd) {
    return { ok: true }
  }
  if (response.redirected && !landedOnAdd) {
    return { ok: true }
  }
  return {
    ok: false,
    error: landedOnAdd
      ? 'Library form rejected this candidate (check name/platform).'
      : `Create failed (${response.status})`,
  }
}

/**
 * Match a newly created library by suggested name (best-effort).
 * @param {string} name
 * @returns {Promise<string|null>} uuid
 */
export async function findLibraryUuidByName(name) {
  const data = await getJson(GET_LIBRARIES_URL)
  const rows = Array.isArray(data) ? data : data.libraries || []
  const want = String(name || '').trim().toLowerCase()
  const hit = rows.find((row) => String(row.name || '').trim().toLowerCase() === want)
  return hit?.uuid || null
}

/**
 * Queue a first scan so last_scan_folder remembers the leaf path.
 * @param {{ uuid: string, path: string, scan_mode: string }} opts
 */
export async function queueLeafScan({ uuid, path, scan_mode }) {
  const { ok, status, data } = await postJsonResult(LIBRARY_SCAN_URL, {
    library_uuid: uuid,
    folder: path,
    scan_mode: scan_mode === 'files' ? 'files' : 'folders',
    queue_policy: 'queue',
    force_parallel: false,
  })
  if (!ok) {
    return {
      ok: false,
      error: data.message || data.error || `Scan queue failed (${status})`,
    }
  }
  return { ok: true, data }
}

/**
 * Confirm path: create each selected library, then queue a first scan when UUID is found.
 * Never invents a mega-lib — one create per candidate.
 * @param {object[]} selected
 * @returns {Promise<{ results: object[], created: number, scanned: number, failed: number }>}
 */
export async function confirmCreateSelected(selected) {
  const results = []
  let created = 0
  let scanned = 0
  let failed = 0

  for (const candidate of selected) {
    const create = await createLibraryFromCandidate(candidate)
    if (!create.ok) {
      failed += 1
      results.push({
        path: candidate.path,
        name: candidate.suggested_name,
        ok: false,
        stage: 'create',
        error: create.error,
      })
      continue
    }
    created += 1

    let uuid = null
    try {
      uuid = await findLibraryUuidByName(candidate.suggested_name)
    } catch {
      uuid = null
    }

    if (!uuid) {
      results.push({
        path: candidate.path,
        name: candidate.suggested_name,
        ok: true,
        stage: 'create',
        note: 'Created. Could not resolve UUID to queue a first scan — use Scan management with this path.',
      })
      continue
    }

    const scan = await queueLeafScan({
      uuid,
      path: candidate.path,
      scan_mode: candidate.scan_mode,
    })
    if (scan.ok) {
      scanned += 1
      results.push({
        path: candidate.path,
        name: candidate.suggested_name,
        uuid,
        ok: true,
        stage: 'scan',
        note: 'Created and queued first scan.',
      })
    } else {
      results.push({
        path: candidate.path,
        name: candidate.suggested_name,
        uuid,
        ok: true,
        stage: 'create',
        note: `Created. Scan not queued: ${scan.error}`,
      })
    }
  }

  return { results, created, scanned, failed }
}
