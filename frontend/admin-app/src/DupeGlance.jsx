import { useEffect, useMemo, useState } from 'react'
import { getJson, postJson } from './adminApi'
import {
  folderBasename,
  mergeDuplicateHits,
  normalizeMatchedGame,
  resolveSearchName,
} from './unmatchedDupe'
import {
  hasStageEHints,
  normalizeStageECandidates,
  normalizeStageEMeta,
  stageEChipSources,
  stageEMatchModeLabel,
  stageESourceLabel,
} from './stageECandidates'
import './DupeGlance.css'

const STATUS_FALLBACK = {
  Duplicate:
    'Another library game already uses this IGDB match and the folder title looks like the same game.',
  Unmatched:
    'Could not auto-match to IGDB (or IGDB already used by a different-titled folder).',
  Ignore: 'Folder is ignored and will not be scanned.',
  Pending: 'Awaiting classification.',
}

/** Machine codes from duplicate_check / scan → one-line librarian copy. */
const MATCH_REASON_LABELS = {
  same_path: 'Same on-disk path as an existing library game.',
  title_vs_folder: 'Folder title closely matches an existing library game folder.',
  title_vs_library_name: 'Folder title closely matches an existing library game name.',
  title_below_threshold:
    'IGDB hit exists, but the folder title differs too much to auto-mark as duplicate.',
}

const MARK_KINDS = [
  { kind: 'experience', label: 'Mark as Experience' },
  { kind: 'emulator', label: 'Mark as Emulator' },
  { kind: 'tool', label: 'Mark as Tool' },
]

const SUGGESTED_KIND_LABELS = {
  experience: 'Experience',
  emulator: 'Emulator',
  tool: 'Tool',
  game: 'Game',
}

/** Normalize API `suggested_kind` (null-safe). Backend may omit until list enrichment lands. */
function normalizeSuggestedKind(value) {
  if (value == null || value === '') return null
  const kind = String(value).trim().toLowerCase()
  return SUGGESTED_KIND_LABELS[kind] ? kind : null
}

/**
 * One-line “why unmatched?” explainer. Prefers Backend `why_unmatched` /
 * `unmatched_reason` when present; otherwise match_reason (+ suggested_kind).
 * Null-safe — returns null when nothing useful.
 */
export function formatWhyUnmatched(row) {
  if (!row || typeof row !== 'object') return null

  const summary =
    (row.why_unmatched != null && String(row.why_unmatched).trim()) ||
    (row.unmatched_reason != null && String(row.unmatched_reason).trim()) ||
    ''
  if (summary) return summary

  const rawReason = row.match_reason == null ? '' : String(row.match_reason).trim()
  let reason = ''
  if (rawReason) {
    const code = rawReason.toLowerCase()
    reason = MATCH_REASON_LABELS[code] || rawReason
  }

  const suggestedKind = normalizeSuggestedKind(row.suggested_kind)
  const suggestedLabel =
    (row.suggested_kind_label != null && String(row.suggested_kind_label).trim()) ||
    (suggestedKind ? SUGGESTED_KIND_LABELS[suggestedKind] : '')
  const candidate =
    row.suggested_candidate_name == null
      ? ''
      : String(row.suggested_candidate_name).trim()

  if (suggestedLabel) {
    const hint = candidate
      ? `Scan suggests cataloging as ${suggestedLabel} (e.g. ${candidate}).`
      : `Scan suggests cataloging as ${suggestedLabel}.`
    if (reason) return `${reason} ${hint}`
    if (row.status === 'Unmatched' || row.status === 'Pending') {
      return `No IGDB game match. ${hint}`
    }
    return hint
  }

  if (reason) return reason
  if (row.status && STATUS_FALLBACK[row.status]) return STATUS_FALLBACK[row.status]
  return null
}

/**
 * Format Backend `match_score` for display beside Why unmatched?
 * Null-safe — returns null when missing / non-numeric.
 * Values ≤1 shown to 2 decimals; 0–100 integers shown as whole numbers.
 */
export function formatMatchScore(score) {
  if (score == null || score === '') return null
  const n = Number(score)
  if (!Number.isFinite(n)) return null
  if (n > 1 && n <= 100) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
  }
  return (Math.round(n * 100) / 100).toFixed(2)
}

/**
 * Ordered Stage A peel trail from Backend `transforms[]`.
 * Soft-degrades when missing / mid-rollout — returns [].
 * @returns {{ stage: string, before: string, after: string, reason: string }[]}
 */
export function normalizeTransforms(row) {
  if (!row || typeof row !== 'object') return []
  const raw = row.transforms
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .filter((step) => step && typeof step === 'object')
    .map((step) => ({
      stage: step.stage == null ? '' : String(step.stage).trim(),
      before: step.before == null ? '' : String(step.before),
      after: step.after == null ? '' : String(step.after),
      reason: step.reason == null ? '' : String(step.reason).trim(),
    }))
    .filter((step) => step.stage || step.before || step.after)
}

/** Compact expander: stage · before → after · reason (reason optional). */
function TransformTrail({ transforms }) {
  const steps = Array.isArray(transforms) ? transforms : []
  if (!steps.length) return null
  return (
    <details className="gt-dupe-glance__transforms">
      <summary className="gt-dupe-glance__transforms-summary">
        Name transform trail ({steps.length})
      </summary>
      <ol className="gt-dupe-glance__transform-list">
        {steps.map((step, index) => (
          <li key={`${step.stage}-${index}`} className="gt-dupe-glance__transform-step">
            <span className="gt-dupe-glance__transform-stage">{step.stage || '—'}</span>
            <span className="gt-dupe-glance__transform-pair">
              <code>{step.before}</code>
              <span aria-hidden="true"> → </span>
              <code>{step.after}</code>
            </span>
            {step.reason ? (
              <span className="gt-dupe-glance__transform-reason">{step.reason}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

/**
 * Quiet Stage E propose-only candidates (Moby / TheGamesDB).
 * Soft-degrades when list API has not flattened proposal fields yet.
 */
function StageECandidates({ row }) {
  if (!hasStageEHints(row)) return null
  const candidates = normalizeStageECandidates(row)
  const meta = normalizeStageEMeta(row)
  const sources = stageEChipSources(candidates)
  const chipDetail = sources.length ? sources.join(' · ') : 'catalog'
  const title =
    'Propose-only catalog hints after Stage D miss — not auto-matched. Use Fix search / Identify to apply.'
  return (
    <div className="gt-dupe-glance__stage-e">
      <span className="gt-dupe-glance__stage-e-chip" title={title}>
        Stage E · propose only · {chipDetail}
      </span>
      {candidates.length > 0 ? (
        <details className="gt-dupe-glance__stage-e-details">
          <summary className="gt-dupe-glance__stage-e-summary">
            Stage E candidates ({candidates.length})
          </summary>
          <p className="gt-dupe-glance__stage-e-note">
            Catalog hints only — Identify to apply. Not auto-matched.
          </p>
          <ul className="gt-dupe-glance__stage-e-list">
            {candidates.map((hit, index) => {
              const source = stageESourceLabel(hit.source)
              const mode = stageEMatchModeLabel(hit.match_mode)
              const label = hit.name || hit.id || 'Candidate'
              return (
                <li
                  key={`${hit.source}-${hit.id || hit.name}-${index}`}
                  className="gt-dupe-glance__stage-e-hit"
                >
                  <span className="gt-dupe-glance__stage-e-source">{source}</span>
                  {hit.url ? (
                    <a
                      className="gt-dupe-glance__stage-e-name"
                      href={hit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                    </a>
                  ) : (
                    <span className="gt-dupe-glance__stage-e-name">{label}</span>
                  )}
                  {mode ? (
                    <span className="gt-dupe-glance__stage-e-mode">{mode}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </details>
      ) : meta ? (
        <p className="gt-dupe-glance__stage-e-meta" title={title}>
          {meta.match_reason || 'Stage E propose-only'} — Identify to apply.
        </p>
      ) : null}
    </div>
  )
}

function markKindsOrdered(suggestedKind) {
  if (!suggestedKind) return MARK_KINDS
  const preferred = MARK_KINDS.find((row) => row.kind === suggestedKind)
  if (!preferred) return MARK_KINDS
  return [preferred, ...MARK_KINDS.filter((row) => row.kind !== suggestedKind)]
}

function DupeOfHit({ row, onOpenPath }) {
  const hit = normalizeMatchedGame(row)
  if (!hit) return null
  const score = formatMatchScore(hit.match_score != null ? hit.match_score : row.match_score)
  return (
    <div className="gt-dupe-glance__dupe-of">
      <span className="gt-dupe-glance__dupe-label">Dupe of:</span>
      {hit.cover_url ? (
        <img className="gt-dupe-glance__dupe-thumb" src={hit.cover_url} alt="" width={28} height={36} />
      ) : (
        <span className="gt-dupe-glance__dupe-thumb gt-dupe-glance__dupe-thumb--empty" aria-hidden="true" />
      )}
      <div className="gt-dupe-glance__dupe-meta">
        {hit.uuid ? (
          <a className="gt-dupe-glance__dupe-title" href={`/game_details/${encodeURIComponent(hit.uuid)}`}>
            {hit.name}
          </a>
        ) : (
          <span className="gt-dupe-glance__dupe-title">{hit.name}</span>
        )}
        {score ? (
          <span className="gt-dupe-glance__match-score" title="Match confidence score">
            {score}
          </span>
        ) : null}
        {hit.uuid ? <code className="gt-dupe-glance__dupe-uuid">{hit.uuid}</code> : null}
        {hit.path ? (
          <button
            type="button"
            className="gt-dupe-glance__dupe-path"
            onClick={() =>
              onOpenPath?.({
                path: hit.path,
                label: 'Library game path',
                matchReason: formatWhyUnmatched(row) || undefined,
              })
            }
          >
            {hit.path}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Compare unmatched / duplicate folders at a glance with fix actions.
 * Open path stays in a modal callback — never navigates to Auto Scan.
 */
export function DupeGlance({ onOpenPath }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fixLog, setFixLog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyFolderId, setBusyFolderId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('Duplicate')

  function load() {
    setLoading(true)
    setError(null)
    return getJson('/api/unmatched_folders')
      .then(async (data) => {
        let list = Array.isArray(data) ? data : []
        const needsEnrich = list.some(
          (row) =>
            (row.status === 'Duplicate' || row.matched_game_uuid) && !normalizeMatchedGame(row),
        )
        if (needsEnrich) {
          try {
            const dupes = await getJson('/api/unmatched_folders/duplicates')
            list = mergeDuplicateHits(list, dupes)
          } catch {
            // Soft-degrade: glance still works without matched_game hit
          }
        }
        setRows(list)
      })
      .catch((err) => {
        setError(err)
        setRows([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [rows, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const row of visible) {
      const key = `${row.library_name || 'Library'}::${row.platform_name || ''}`
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [visible])

  async function handleReclassify() {
    setBusy(true)
    setFixLog(null)
    try {
      const result = await postJson('/api/unmatched_folders/reclassify_duplicates', {})
      setFixLog({
        ok: true,
        message: `Reclassified ${result.changed_count ?? 0} · kept ${result.kept_count ?? 0} as duplicate`,
        detail: result,
      })
      await load()
    } catch (err) {
      setFixLog({ ok: false, message: err?.message || 'Reclassify failed' })
    } finally {
      setBusy(false)
    }
  }

  async function handleBackfillKindHints() {
    if (
      !window.confirm(
        'Backfill Suggested kind hints from on-disk scan proposals for rows that still have null hints? Safe to re-run; only updates empty hints.',
      )
    ) {
      return
    }
    setBusy(true)
    setFixLog(null)
    try {
      const result = await postJson('/api/unmatched_folders/backfill_suggested_kind', {})
      const updated = result.updated ?? 0
      const scanned = result.scanned ?? 0
      setFixLog({
        ok: true,
        message: `Kind hints updated ${updated} of ${scanned} scanned${
          result.skipped_no_sidecar ? ` · ${result.skipped_no_sidecar} without proposal` : ''
        }`,
        detail: result,
      })
      await load()
    } catch (err) {
      setFixLog({ ok: false, message: err?.message || 'Backfill kind hints failed' })
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkKind(row, itemKind) {
    if (busy) return
    setBusy(true)
    setBusyFolderId(row.id)
    setFixLog(null)
    const name = resolveSearchName(row) || folderBasename(row.folder_path)
    try {
      const result = await postJson(`/api/unmatched_folders/${row.id}/mark_kind`, {
        item_kind: itemKind,
        ...(name ? { name } : {}),
      })
      const kindLabel =
        itemKind === 'experience'
          ? 'Experience'
          : itemKind === 'emulator'
            ? 'Emulator'
            : 'Tool'
      setFixLog({
        ok: true,
        message: `Cataloged “${result.name || name || 'folder'}” as ${kindLabel} (no IGDB game match)`,
      })
      await load()
    } catch (err) {
      setFixLog({
        ok: false,
        message: err?.message || `Could not mark as ${itemKind}`,
      })
    } finally {
      setBusy(false)
      setBusyFolderId(null)
    }
  }

  async function handleFix(row, action) {
    if (busy) return
    setBusy(true)
    setBusyFolderId(row.id)
    setFixLog(null)
    try {
      const result = await postJson(`/api/unmatched_folders/${row.id}/fix`, { action })
      const label = action === 'merge' ? 'Merged' : action === 'keep' ? 'Kept as Unmatched' : 'Ignored'
      setFixLog({
        ok: true,
        message: `${label}${result.folder_path ? ` · ${result.folder_path}` : ''}`,
      })
      await load()
    } catch (err) {
      setFixLog({ ok: false, message: err?.message || `Could not ${action}` })
    } finally {
      setBusy(false)
      setBusyFolderId(null)
    }
  }

  function canMarkKind(status) {
    return status === 'Unmatched' || status === 'Pending' || status === 'Duplicate'
  }

  return (
    <section className="gt-dupe-glance" aria-labelledby="gt-dupe-glance-title">
      <div className="gt-dupe-glance__header">
        <div>
          <h2 id="gt-dupe-glance-title">Dupe glance</h2>
          <p className="gt-dupe-glance__lede">
            Compare unmatched / duplicate folders without leaving this page. Open path opens a popup
            (clipboard / companion) — it does not jump to Auto Scan. Mark as Experience / Emulator /
            Tool catalogs gaming software without a fake IGDB game match. Duplicate rows show the
            library hit as Dupe of (same as Scan management base table).
          </p>
        </div>
        <div className="gt-dupe-glance__toolbar">
          <label>
            Status{' '}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="Duplicate">Duplicate</option>
              <option value="Unmatched">Unmatched</option>
              <option value="Ignore">Ignore</option>
              <option value="all">All</option>
            </select>
          </label>
          <button type="button" className="gt-btn" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="gt-btn gt-btn--primary"
            disabled={busy}
            onClick={() => void handleReclassify()}
            title="Downgrade false Duplicate rows when folder titles differ"
          >
            {busy && !busyFolderId ? 'Fixing…' : 'Fix false duplicates'}
          </button>
          <button
            type="button"
            className="gt-btn"
            disabled={busy}
            onClick={() => void handleBackfillKindHints()}
            title="Fill missing Suggested kind chips from on-disk scan proposals (legacy rows)"
          >
            Backfill kind hints
          </button>
        </div>
      </div>

      {fixLog ? (
        <p
          className={`gt-dupe-glance__log${fixLog.ok ? ' is-ok' : ' is-error'}`}
          role="status"
        >
          {fixLog.message}
        </p>
      ) : null}

      {loading ? <p>Loading unmatched folders…</p> : null}
      {error ? <div role="alert">Unable to load unmatched folders.</div> : null}

      {!loading && !error && visible.length === 0 ? (
        <p className="gt-dupe-glance__empty">No folders for this filter.</p>
      ) : null}

      {grouped.map(([groupKey, items]) => (
        <div key={groupKey} className="gt-dupe-glance__group">
          <h3>{groupKey.replace('::', ' · ')}</h3>
          <ul className="gt-dupe-glance__list">
            {items.map((row) => {
              const why = formatWhyUnmatched(row)
              const matchScore = formatMatchScore(row.match_score)
              const transforms = normalizeTransforms(row)
              const marking = busyFolderId === row.id
              const suggestedKind = normalizeSuggestedKind(row.suggested_kind)
              const markKinds = markKindsOrdered(suggestedKind)
              const showWhyUnmatchedLabel =
                row.status === 'Unmatched' || row.status === 'Pending'
              const diskName = folderBasename(row.folder_path)
              const searchName = resolveSearchName(row)
              const showStageE = hasStageEHints(row)
              const showWhyBlock =
                Boolean(why) ||
                (Boolean(matchScore) && row.status !== 'Duplicate') ||
                transforms.length > 0 ||
                showStageE
              return (
                <li key={row.id} className="gt-dupe-glance__row">
                  <div className="gt-dupe-glance__meta">
                    <div className="gt-dupe-glance__chips">
                      <span className={`gt-dupe-glance__status status-${String(row.status || '').toLowerCase()}`}>
                        {row.status === 'Duplicate' ? 'Duplicate (same title)' : row.status}
                      </span>
                      {suggestedKind ? (
                        <span
                          className="gt-dupe-glance__suggested"
                          title="Suggested kind from scan proposal (software path)"
                        >
                          Suggested {SUGGESTED_KIND_LABELS[suggestedKind]}
                        </span>
                      ) : null}
                    </div>
                    {searchName && searchName !== diskName ? (
                      <p className="gt-dupe-glance__amend">
                        <span className="gt-dupe-glance__amend-label">Amend naming</span> {searchName}
                        <span className="gt-dupe-glance__ondisk"> · On disk: {diskName}</span>
                      </p>
                    ) : diskName ? (
                      <p className="gt-dupe-glance__ondisk">On disk: {diskName}</p>
                    ) : null}
                    <code title={row.folder_path}>{row.folder_path}</code>
                    <DupeOfHit row={row} onOpenPath={onOpenPath} />
                    {showWhyBlock ? (
                      <div className="gt-dupe-glance__why">
                        {why || (matchScore && row.status !== 'Duplicate') ? (
                          <p className="gt-dupe-glance__reason">
                            {showWhyUnmatchedLabel ? (
                              <span className="gt-dupe-glance__why-label">Why unmatched? </span>
                            ) : null}
                            {matchScore && row.status !== 'Duplicate' ? (
                              <span
                                className="gt-dupe-glance__match-score"
                                title="Match confidence score"
                              >
                                {matchScore}
                              </span>
                            ) : null}
                            {why ? (
                              <>
                                {matchScore && row.status !== 'Duplicate' ? ' ' : null}
                                {why}
                              </>
                            ) : null}
                          </p>
                        ) : showWhyUnmatchedLabel ? (
                          <p className="gt-dupe-glance__reason">
                            <span className="gt-dupe-glance__why-label">Why unmatched? </span>
                          </p>
                        ) : null}
                        <TransformTrail transforms={transforms} />
                        <StageECandidates row={row} />
                      </div>
                    ) : null}
                  </div>
                  <div className="gt-dupe-glance__actions">
                    <button
                      type="button"
                      className="gt-btn"
                      onClick={() =>
                        onOpenPath?.({
                          path: row.folder_path,
                          label: 'Unmatched folder',
                          matchReason: why || undefined,
                        })
                      }
                    >
                      Open path
                    </button>
                    <a
                      className="gt-btn"
                      href={`/add_game_manual?full_disk_path=${encodeURIComponent(row.folder_path || '')}&library_uuid=${encodeURIComponent(row.library_uuid || '')}&platform_name=${encodeURIComponent(row.platform_name || '')}&platform_id=${encodeURIComponent(row.platform_id || '')}&from_unmatched=true`}
                      title="Fix search — opens manual add / IGDB search (uses amended search_name when set)"
                    >
                      Fix search
                    </a>
                    {canMarkKind(row.status)
                      ? markKinds.map(({ kind, label }) => (
                          <button
                            key={kind}
                            type="button"
                            className={`gt-btn${suggestedKind === kind ? ' gt-btn--primary is-suggested' : ''}`}
                            disabled={busy}
                            title={
                              suggestedKind === kind
                                ? `Suggested: catalog as ${label.replace('Mark as ', '')} without an IGDB game match`
                                : `Catalog as ${label.replace('Mark as ', '')} without an IGDB game match`
                            }
                            onClick={() => void handleMarkKind(row, kind)}
                          >
                            {marking ? 'Saving…' : label}
                          </button>
                        ))
                      : null}
                    {row.status === 'Duplicate' ? (
                      <>
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={busy}
                          title="Keep library game; clear this duplicate row"
                          onClick={() => void handleFix(row, 'merge')}
                        >
                          Merge
                        </button>
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={busy}
                          title="Reclassify as Unmatched"
                          onClick={() => void handleFix(row, 'keep')}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          className="gt-btn"
                          disabled={busy}
                          title="Ignore this duplicate"
                          onClick={() => void handleFix(row, 'ignore')}
                        >
                          Ignore
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
