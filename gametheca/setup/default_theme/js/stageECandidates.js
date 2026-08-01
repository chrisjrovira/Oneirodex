/**
 * Stage E propose-only catalog hints (MobyGames / TheGamesDB).
 * Soft-degrades when list API has not flattened proposal fields yet.
 *
 * Expected shapes (any one may be present):
 * - row.stage_e_candidates[]
 * - row.stage_e / row.proposal.stage_e meta
 * - nested proposal.stage_e_candidates (proposal or proposal.proposal)
 */

const SOURCE_LABELS = {
  mobygames: 'MobyGames',
  moby: 'MobyGames',
  thegamesdb: 'TheGamesDB',
  tgdb: 'TheGamesDB',
}

const MATCH_MODE_LABELS = {
  moby_exact: 'Exact',
  moby_exact_ambiguous: 'Ambiguous',
  tgdb_exact: 'Exact',
  tgdb_exact_ambiguous: 'Ambiguous',
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>|null}
 */
function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

/**
 * Pull proposal body whether API nests as `proposal` or `proposal.proposal`.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {Record<string, unknown>|null}
 */
export function resolveProposalBody(row) {
  if (!row || typeof row !== 'object') return null
  const top = asObject(row.proposal)
  if (!top) return null
  const nested = asObject(top.proposal)
  return nested || top
}

/**
 * @param {unknown} raw
 * @returns {{source:string,id:string,name:string,url:string,cover_url:string,match_mode:string,propose_only:boolean,identify_path:string,mobygames_id:string,thegamesdb_id:string,platforms:unknown}[]}
 */
export function normalizeStageECandidateList(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .filter((hit) => hit && typeof hit === 'object')
    .map((hit) => {
      const source = hit.source == null ? '' : String(hit.source).trim().toLowerCase()
      const name = hit.name == null ? '' : String(hit.name).trim()
      const id =
        hit.id != null && String(hit.id).trim()
          ? String(hit.id).trim()
          : hit.mobygames_id != null && String(hit.mobygames_id).trim()
            ? String(hit.mobygames_id).trim()
            : hit.thegamesdb_id != null && String(hit.thegamesdb_id).trim()
              ? String(hit.thegamesdb_id).trim()
              : ''
      return {
        source,
        id,
        name,
        url: hit.url == null ? '' : String(hit.url).trim(),
        cover_url: hit.cover_url == null ? '' : String(hit.cover_url).trim(),
        match_mode: hit.match_mode == null ? '' : String(hit.match_mode).trim().toLowerCase(),
        propose_only: hit.propose_only !== false,
        identify_path:
          hit.identify_path == null ? 'stage_e' : String(hit.identify_path).trim() || 'stage_e',
        mobygames_id: hit.mobygames_id == null ? '' : String(hit.mobygames_id).trim(),
        thegamesdb_id: hit.thegamesdb_id == null ? '' : String(hit.thegamesdb_id).trim(),
        platforms: hit.platforms,
      }
    })
    .filter((hit) => hit.name || hit.id || hit.source)
}

/**
 * Ordered Stage E candidates from list/detail/export row (or nested proposal).
 * Soft-degrades → [].
 * @param {Record<string, unknown>|null|undefined} row
 */
export function normalizeStageECandidates(row) {
  if (!row || typeof row !== 'object') return []
  const top = normalizeStageECandidateList(row.stage_e_candidates)
  if (top.length) return top
  const body = resolveProposalBody(row)
  if (body) {
    const nested = normalizeStageECandidateList(body.stage_e_candidates)
    if (nested.length) return nested
  }
  return []
}

/**
 * Stage E meta `{match_reason, identify_path, skipped[], propose_only}`.
 * Soft-degrades → null.
 * @param {Record<string, unknown>|null|undefined} row
 */
export function normalizeStageEMeta(row) {
  if (!row || typeof row !== 'object') return null
  let meta = asObject(row.stage_e)
  if (!meta) {
    const body = resolveProposalBody(row)
    meta = body ? asObject(body.stage_e) : null
  }
  if (!meta) return null
  const matchReason =
    meta.match_reason == null ? '' : String(meta.match_reason).trim()
  const identifyPath =
    meta.identify_path == null ? '' : String(meta.identify_path).trim()
  const skipped = Array.isArray(meta.skipped)
    ? meta.skipped.map((s) => String(s)).filter(Boolean)
    : []
  if (!matchReason && !identifyPath && skipped.length === 0 && meta.propose_only == null) {
    return null
  }
  return {
    match_reason: matchReason,
    identify_path: identifyPath || 'stage_e',
    skipped,
    propose_only: meta.propose_only !== false,
  }
}

/** Human source label for chip / list. */
export function stageESourceLabel(source) {
  const key = source == null ? '' : String(source).trim().toLowerCase()
  return SOURCE_LABELS[key] || (key ? key : 'Catalog')
}

/** Human match_mode label. */
export function stageEMatchModeLabel(mode) {
  const key = mode == null ? '' : String(mode).trim().toLowerCase()
  return MATCH_MODE_LABELS[key] || (key ? key : '')
}

/**
 * True when row carries Stage E propose-only signal (candidates and/or meta).
 * Does not infer from suggested_candidate_name alone (may be software path).
 * @param {Record<string, unknown>|null|undefined} row
 */
export function hasStageEHints(row) {
  if (!row || typeof row !== 'object') return false
  if (normalizeStageECandidates(row).length > 0) return true
  if (normalizeStageEMeta(row)) return true
  const path =
    row.identify_path == null ? '' : String(row.identify_path).trim().toLowerCase()
  if (path === 'stage_e') return true
  const reason =
    row.stage_e_match_reason == null
      ? row.match_reason == null
        ? ''
        : String(row.match_reason).trim().toLowerCase()
      : String(row.stage_e_match_reason).trim().toLowerCase()
  return reason.startsWith('stage_e')
}

/**
 * Compact chip sources present on candidates (e.g. "MobyGames · TheGamesDB").
 * @param {{source:string}[]} candidates
 */
export function stageEChipSources(candidates) {
  const labels = []
  const seen = new Set()
  for (const hit of candidates || []) {
    const label = stageESourceLabel(hit.source)
    if (!seen.has(label)) {
      seen.add(label)
      labels.push(label)
    }
  }
  return labels
}
