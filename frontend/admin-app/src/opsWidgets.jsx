/**
 * Shared Ops / Dashboard widgets for the observability console.
 * Keep presentation here; pages own fetch / poll cadence.
 */

export function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return 'n/a'
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(Math.abs(n)) / Math.log(1024)), units.length - 1)
  const value = n / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

/** Treat null / undefined as n/a for Grafana-style empty metrics. */
export function na(value, suffix = '') {
  if (value == null || value === '') return 'n/a'
  return suffix ? `${value}${suffix}` : String(value)
}

/**
 * Banner headline — the overall verdict.
 *
 * GT-C1 (UID-013): these deliberately do NOT reuse the fold titles
 * ("Action required" / "Warning / Info"). They used to, which meant the banner
 * <strong> and the <h2> directly beneath it rendered the same words — the
 * duplicate the human kept reporting on the Dashboard. The banner answers
 * "how is the server?"; the folds answer "which bucket is this issue in?".
 */
export function severityLabel(severity) {
  if (severity === 'bad') return 'Needs attention'
  if (severity === 'warn') return 'Degraded'
  return 'All systems healthy'
}

/**
 * Bucket an issue for the two-fold Ops list.
 * Prefer Backend `category` when present; else map severity.
 * - action: category === 'action' (fallback severity === 'bad')
 * - soft: category warning|info (fallback warn|info)
 * Disk capacity ids (e.g. disk_*_critical) stay soft when Backend emits warning/warn.
 */
export function issueFold(item) {
  if (!item || typeof item !== 'object') return 'soft'
  const category = item.category
  if (category === 'action') return 'action'
  if (category === 'warning' || category === 'info') return 'soft'
  if (item.severity === 'bad') return 'action'
  if (item.severity === 'warn' || item.severity === 'info') return 'soft'
  return 'soft'
}

/** Split issues into Action required vs Warning / Info (empty buckets omitted by callers). */
export function partitionIssues(items) {
  const rows = Array.isArray(items) ? items : []
  const action = []
  const soft = []
  for (const item of rows) {
    if (issueFold(item) === 'action') action.push(item)
    else soft.push(item)
  }
  return { action, soft }
}

/**
 * Banner tone from items when present: any action → bad; else soft → warn; else fallback.
 */
export function resolveBannerSeverity(items, fallback = 'good') {
  const { action, soft } = partitionIssues(items)
  if (action.length) return 'bad'
  if (soft.length) return 'warn'
  if (fallback === 'bad' || fallback === 'warn' || fallback === 'good') return fallback
  return 'good'
}

function OpsIssueRows({ items, toneFallback = 'warn' }) {
  return items.map((item) => {
    const tone =
      item.severity === 'bad' || item.severity === 'warn' || item.severity === 'info'
        ? item.severity === 'info'
          ? 'warn'
          : item.severity
        : toneFallback
    return (
      <li
        key={item.id || item.message}
        className={`od-ops-issues__item od-ops-issues__item--${tone}`}
      >
        {item.href ? <a href={item.href}>{item.message}</a> : <span>{item.message}</span>}
      </li>
    )
  })
}

export function OpsIssuesList({ items }) {
  const { action, soft } = partitionIssues(items)
  if (!action.length && !soft.length) return null
  return (
    <div className="od-ops-issues-folds">
      {action.length ? (
        <section className="od-ops-issues-fold od-ops-issues-fold--action" aria-label="Action required">
          <h2 className="od-ops-issues-fold__title">Action required</h2>
          <ul className="od-ops-issues">
            <OpsIssueRows items={action} toneFallback="bad" />
          </ul>
        </section>
      ) : null}
      {soft.length ? (
        <section className="od-ops-issues-fold od-ops-issues-fold--soft" aria-label="Warning / Info">
          <h2 className="od-ops-issues-fold__title">Warning / Info</h2>
          <ul className="od-ops-issues">
            <OpsIssueRows items={soft} toneFallback="warn" />
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function IconReset(props) {
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden="true" {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
      />
    </svg>
  )
}

export function OpsStatusBanner({
  severity = 'good',
  asOf,
  items,
  ariaLabel = 'System status',
  onRefresh = null,
  refreshing = false,
  refreshDisabled = false,
}) {
  const tone = resolveBannerSeverity(items, severity)
  return (
    <section className={`od-ops-status od-ops-status--${tone}`} aria-label={ariaLabel}>
      <div className="od-ops-status__head">
        <strong>{severityLabel(tone)}</strong>
        {/* Trail chrome only when this banner owns Updated/refresh. Dashboard
            and Ops put those in the top bar, so leave the slot empty. */}
        {asOf || onRefresh ? (
          <div className="od-ops-status__trail">
            {asOf ? (
              <span className="od-ops-status__asof">
                Updated {new Date(asOf).toLocaleString()}
              </span>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                className="od-cbtn od-ops-status__refresh"
                aria-label={refreshing ? 'Refreshing' : 'Refresh dashboard'}
                title="Refresh"
                onClick={onRefresh}
                disabled={refreshDisabled || refreshing}
              >
                <IconReset />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <OpsIssuesList items={items} />
    </section>
  )
}

/**
 * Tone for a "higher is worse" metric — utilisation, latency, queue depth.
 *
 * Colour only where it means something (UX-C12): an unknown value returns 'na'
 * rather than green, because "we could not read it" is not "healthy".
 */
export function usageTone(value, { warn = 85, bad = 95 } = {}) {
  const n = Number(value)
  if (value == null || !Number.isFinite(n)) return 'na'
  if (n >= bad) return 'poor'
  if (n >= warn) return 'fair'
  return 'good'
}

/** Tone for a "higher is better" metric — free space, online companions. */
export function healthTone(value, { warn = 50, bad = 20 } = {}) {
  const n = Number(value)
  if (value == null || !Number.isFinite(n)) return 'na'
  if (n <= bad) return 'poor'
  if (n <= warn) return 'fair'
  return 'good'
}

/** Tone for a plain up/down signal. */
export function booleanTone(ok) {
  if (ok == null) return 'na'
  return ok ? 'good' : 'poor'
}

export function MeterBar({ label, percent, detail }) {
  const pct = percent == null || !Number.isFinite(Number(percent)) ? null : Math.max(0, Math.min(100, Number(percent)))
  const tone =
    pct == null ? 'na' : pct >= 95 ? 'bad' : pct >= 85 ? 'warn' : 'good'
  return (
    <div className={`od-ops-meter od-ops-meter--${tone}`}>
      <div className="od-ops-meter__label">
        <span>{label}</span>
        <span>{pct == null ? 'n/a' : `${pct}%`}</span>
      </div>
      <div className="od-ops-meter__track" aria-hidden="true">
        <div className="od-ops-meter__fill" style={{ width: pct == null ? '0%' : `${pct}%` }} />
      </div>
      {detail ? <div className="od-ops-meter__detail">{detail}</div> : null}
    </div>
  )
}

const METRIC_TONES = new Set([
  'good',
  'fair',
  'poor',
  'na',
  'action',
  'warning',
  'info',
])

export function MetricTile({ label, value, hint, tone }) {
  const toneClass = METRIC_TONES.has(tone) ? ` od-ops-metric--${tone}` : ''
  return (
    <div className={`od-ops-metric${toneClass}`}>
      <div className="od-ops-metric__label">{label}</div>
      <div className="od-ops-metric__value">{value}</div>
      {hint ? <div className="od-ops-metric__hint">{hint}</div> : null}
    </div>
  )
}

/**
 * Reusable metric strip (GT-C2 / UID-014).
 *
 * Dashboard and Ops were the only two pages with colour-reactive metric
 * chrome, because the strip markup lived inline in those two files. Every other
 * admin page — Users, Support, Invites, Storage, Extensions — had no summary
 * row at all, which is what "admin metrics not color-reactive like dashboard"
 * was describing.
 *
 * Pass `items` as `{ id, label, value, hint, tone }`. Entries are skipped when
 * `value` is undefined so a page can declare optional metrics without branching.
 */
export function MetricStrip({ items = [], label = 'Key metrics' }) {
  const rows = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.value !== undefined,
  )
  if (!rows.length) return null
  return (
    <div className="od-ops-strip" aria-label={label}>
      {rows.map((item) => (
        <MetricTile
          key={item.id || item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          tone={item.tone}
        />
      ))}
    </div>
  )
}

/** Disk / CPU-style percent → good | warning | action | na (aurora issue tones). */
export function percentHealthTone(percent) {
  if (percent == null || !Number.isFinite(Number(percent))) return 'na'
  const pct = Number(percent)
  if (pct >= 95) return 'action'
  if (pct >= 85) return 'warning'
  if (pct >= 70) return 'fair'
  return 'good'
}

/** Readyz string/object → good | action | warning | info | na. */
export function awakeTone(awake) {
  if (!awake) return 'na'
  const status = String(awake.status || awake || '').toLowerCase()
  if (status === 'ok' || status === 'ready' || status === 'pass') return 'good'
  if (status === 'fail' || status === 'failed' || status === 'error' || status === 'down') {
    return 'action'
  }
  if (status === 'degraded' || status === 'warn' || status === 'warning') return 'warning'
  if (status === 'unknown' || status === 'n/a') return 'na'
  return 'info'
}

/** Active scan count → info when busy, good when idle, na when missing. */
export function scansActiveTone(activeCount) {
  if (activeCount == null || !Number.isFinite(Number(activeCount))) return 'na'
  return Number(activeCount) > 0 ? 'info' : 'good'
}

/** Companions online/registered → good / fair / warning / na. */
export function companionsTone(companions) {
  if (!companions) return 'na'
  const online = Number(companions.online)
  const registered = Number(companions.registered)
  if (!Number.isFinite(registered) || registered <= 0) {
    return Number.isFinite(online) && online > 0 ? 'info' : 'na'
  }
  if (!Number.isFinite(online) || online <= 0) return 'warning'
  if (online < registered) return 'fair'
  return 'good'
}

/** DB ping ms → good / fair / warning / action / na. */
export function dbPingTone(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return 'na'
  const n = Number(ms)
  if (n >= 500) return 'action'
  if (n >= 200) return 'warning'
  if (n >= 80) return 'fair'
  return 'good'
}

export function formatLoadAvg(loadAvg) {
  if (!loadAvg || typeof loadAvg !== 'object') return 'n/a'
  const one = loadAvg['1'] ?? loadAvg[1]
  const five = loadAvg['5'] ?? loadAvg[5]
  const fifteen = loadAvg['15'] ?? loadAvg[15]
  if (one == null && five == null && fifteen == null) return 'n/a'
  return `${na(one)} / ${na(five)} / ${na(fifteen)}`
}

export function formatReadyz(awake) {
  if (!awake) return 'n/a'
  const status = awake.status || 'unknown'
  const ms = awake.check_ms != null ? ` · ${awake.check_ms}ms` : ''
  return `${status}${ms}`
}

/**
 * Compact status for services.library_watch (ONEIRODEX_LIBRARY_WATCH, default off).
 * Honest when disabled — operators should see "off", not a false healthy.
 */
export function formatLibraryWatchStatus(watch) {
  if (!watch || typeof watch !== 'object') return 'n/a'
  if (!watch.enabled) return 'off'
  if (watch.running) return 'running'
  return 'enabled (not running)'
}

/** Detail line: note when off / not started; else roots · pending · debounce. */
export function formatLibraryWatchDetail(watch) {
  if (!watch || typeof watch !== 'object') return 'n/a'
  if (!watch.enabled) {
    return watch.note || 'Set ONEIRODEX_LIBRARY_WATCH=1 to enable.'
  }
  const roots = watch.roots ?? 0
  const pending = watch.pending_libraries ?? 0
  const debounce =
    watch.debounce_seconds != null && Number.isFinite(Number(watch.debounce_seconds))
      ? Number(watch.debounce_seconds)
      : null
  const pulse = `${roots} roots · ${pending} pending${debounce != null ? ` · ${debounce}s debounce` : ''}`
  if (!watch.running && watch.note) return `${watch.note} · ${pulse}`
  return pulse
}

export function companionKindRows(byKind) {
  if (!byKind || typeof byKind !== 'object') return []
  return Object.entries(byKind).map(([kind, counts]) => ({
    kind,
    online: counts?.online ?? 0,
    registered: counts?.registered ?? 0,
  }))
}

/**
 * Normalize `library.health` from ops summary (Wave 6).
 * Primary: `{ score: 0-100, grade: good|fair|poor, factors: [{id, label, count, weight?}] }`.
 * Defensive remaps: `average_score` / letter grades / `top_issues` from older health APIs.
 * Returns null when nothing useful — callers show honest n/a.
 */
export function normalizeLibraryHealth(health) {
  if (!health || typeof health !== 'object') return null

  let score = health.score
  if (score == null && health.average_score != null) score = health.average_score
  const scoreNum = score == null || score === '' ? null : Number(score)
  const hasScore = scoreNum != null && Number.isFinite(scoreNum)

  let gradeRaw =
    health.grade == null || health.grade === '' ? '' : String(health.grade).trim().toLowerCase()
  if (!gradeRaw && hasScore) {
    if (scoreNum >= 80) gradeRaw = 'good'
    else if (scoreNum >= 50) gradeRaw = 'fair'
    else gradeRaw = 'poor'
  } else if (gradeRaw === 'a' || gradeRaw === 'b') {
    gradeRaw = 'good'
  } else if (gradeRaw === 'c') {
    gradeRaw = 'fair'
  } else if (gradeRaw === 'd' || gradeRaw === 'f') {
    gradeRaw = 'poor'
  } else if (gradeRaw === 'warn' || gradeRaw === 'warning') {
    gradeRaw = 'fair'
  } else if (gradeRaw === 'bad' || gradeRaw === 'critical') {
    gradeRaw = 'poor'
  } else if (gradeRaw !== 'good' && gradeRaw !== 'fair' && gradeRaw !== 'poor') {
    gradeRaw = hasScore ? (scoreNum >= 80 ? 'good' : scoreNum >= 50 ? 'fair' : 'poor') : ''
  }

  let factors = Array.isArray(health.factors) ? health.factors : null
  if (!factors && Array.isArray(health.top_issues)) {
    factors = health.top_issues.map((issue) => {
      if (!issue || typeof issue !== 'object') return null
      const id = issue.id || issue.code || null
      const label = issue.label || issue.code || issue.id || null
      if (!id && !label) return null
      return {
        id: id || label,
        label: label || id,
        count: issue.count ?? null,
        weight: issue.weight ?? issue.severity ?? null,
        deduction: issue.deduction ?? null,
      }
    }).filter(Boolean)
  } else if (factors) {
    factors = factors
      .map((f) => {
        if (!f || typeof f !== 'object') return null
        const id = f.id || f.code || null
        const label = f.label || f.code || f.id || null
        if (!id && !label) return null
        return {
          id: id || label,
          label: label || id,
          count: f.count ?? null,
          weight: f.weight ?? null,
          deduction: f.deduction ?? null,
        }
      })
      .filter(Boolean)
  }

  const thin = Boolean(
    health.thin ||
      health.sample_thin ||
      health.count === 0 ||
      health.games === 0,
  )
  if (!hasScore && !gradeRaw && !(factors && factors.length) && !thin) return null

  return {
    score: hasScore ? scoreNum : null,
    grade: gradeRaw || null,
    factors: factors || [],
    thin,
    note: health.note == null || health.note === '' ? null : String(health.note),
  }
}

/** Rank factors for display — prefer deduction, then count; drop zero-impact when others exist. */
export function topLibraryHealthFactors(health, limit = 3) {
  const n = normalizeLibraryHealth(health)
  if (!n) return []
  const ranked = [...(n.factors || [])].sort((a, b) => {
    const da = Number(a.deduction)
    const db = Number(b.deduction)
    if (Number.isFinite(da) || Number.isFinite(db)) {
      return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0)
    }
    return (Number(b.count) || 0) - (Number(a.count) || 0)
  })
  const nonzero = ranked.filter((f) => (Number(f.count) || 0) > 0 || (Number(f.deduction) || 0) > 0)
  const pool = nonzero.length ? nonzero : ranked
  return pool.slice(0, limit)
}

/**
 * MetricTile tone from library.health grade — good|fair|poor|na.
 * Honest na when thin/null/withheld (no false accent healthy).
 */
export function libraryHealthTone(health) {
  const n = normalizeLibraryHealth(health)
  if (!n?.grade) return 'na'
  if (n.grade === 'good' || n.grade === 'fair' || n.grade === 'poor') return n.grade
  return 'na'
}

/** Compact score for MetricTile — rounded 0–100 or n/a. */
export function formatLibraryHealthScore(health) {
  const n = normalizeLibraryHealth(health)
  if (!n || n.score == null || !Number.isFinite(Number(n.score))) return 'n/a'
  return String(Math.round(Number(n.score)))
}

/** Metric value: `82 · good` when both present; otherwise score, grade, or n/a. */
export function formatLibraryHealthValue(health) {
  const n = normalizeLibraryHealth(health)
  if (!n) return 'n/a'
  const score = n.score != null && Number.isFinite(Number(n.score)) ? String(Math.round(Number(n.score))) : null
  if (score && n.grade) return `${score} · ${n.grade}`
  if (score) return score
  if (n.grade) return n.grade
  return 'n/a'
}

/** Hint line: top factor labels, grade, or honest empty/thin copy. */
export function formatLibraryHealthHint(health, limit = 2) {
  const n = normalizeLibraryHealth(health)
  if (!n) return 'not scored yet'
  const tops = topLibraryHealthFactors(health, limit)
    .map((f) => (f?.label != null && String(f.label).trim()) || (f?.id != null && String(f.id).trim()) || '')
    .filter(Boolean)
  if (tops.length) return tops.join(' · ')
  if (n.thin) return n.note || 'sample thin'
  if (n.grade) return n.grade
  return 'no factors'
}

/** Left-edge grade cue class — poor=danger, fair=warn-gold; good/na unchanged. */
export function libraryHealthFactorsGradeClass(grade) {
  if (grade === 'poor') return ' od-ops-health-factors--poor'
  if (grade === 'fair') return ' od-ops-health-factors--fair'
  return ''
}

/**
 * Top health factors list for Library pulse / Services-adjacent.
 * Honest empty when health absent or factors empty.
 * Grade cues: poor → danger left edge; fair → warn-gold (good/na unchanged).
 */
export function LibraryHealthFactors({ health, limit = 3 }) {
  const n = normalizeLibraryHealth(health)
  if (!n) {
    return (
      <p className="od-admin-lede od-ops-health-factors od-ops-health-factors--empty">
        Library health not scored yet.
      </p>
    )
  }
  const gradeClass = libraryHealthFactorsGradeClass(n.grade)
  const factors = topLibraryHealthFactors(health, limit)
  if (!factors.length) {
    return (
      <p
        className={`od-admin-lede od-ops-health-factors od-ops-health-factors--empty${gradeClass}`}
      >
        {n.thin
          ? n.note || 'Library health sample thin — no factor breakdown yet.'
          : n.grade
            ? `Grade ${n.grade} · no top factors.`
            : 'No top health factors.'}
      </p>
    )
  }
  return (
    <ul className={`od-ops-health-factors${gradeClass}`} aria-label="Top health factors">
      {factors.map((f) => {
        const key = f.id || f.label
        const label = f.label || f.id || 'factor'
        return (
          <li key={key} className="od-ops-health-factors__item">
            <span className="od-ops-health-factors__label">{label}</span>
            {f.count != null && Number.isFinite(Number(f.count)) ? (
              <span className="od-ops-health-factors__count">{f.count}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Honest scan glance: processed (= success+failed) / total, matching Scan Jobs.
 *
 * Moved here from OpsPage (GT-B34) so the Scans page can use it too. It lived
 * next to its only caller while the Ops dashboard was the only surface showing
 * scan progress — which was itself the bug: the page an operator actually
 * watches a scan on showed less than the dashboard did.
 */
export function formatScanJobCounters(job) {
  const success = Number(job?.folders_success) || 0
  const failed = Number(job?.folders_failed) || 0
  const total = Number(job?.total_folders) || 0
  const processed = success + failed
  if (total > 0) {
    return `${processed}/${total}` + (failed ? ` · ${failed} failed` : '')
  }
  if (job?.status === 'Queued' || job?.status === 'Pending') {
    return job?.queue_position != null ? `Queued #${job.queue_position}` : 'Queued'
  }
  if (job?.status === 'Running' || job?.status === 'Stopping') {
    return 'Starting…'
  }
  if (job?.progress != null && Number(job.progress) > 0) {
    return `${job.progress}%`
  }
  return '—'
}
