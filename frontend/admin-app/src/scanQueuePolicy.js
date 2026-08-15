/**
 * Admin scan start conflict policy — field map shared with Backend.
 *
 * Request (JSON body or form fields):
 *   queue_policy: 'queue' | 'force'   (default queue)
 *   force_parallel: true | '1'        (alias for queue_policy=force)
 *
 * Surfaces (same fields): Auto Scan · Manual Scan when busy (Jinja
 * admin_manage_scanjobs.js interceptScanFormSubmit) · Refresh all ·
 * restart-while-busy. Idle Manual does not send these (List Games identify).
 *
 * Response:
 *   status: 'queued' | 'started' | 'rejected'
 *   job_id?, position?, message?, error?, coalesced?, coalesced_count?, risk?
 *
 * Legacy: HTTP 409 + { error: 'A scan is already running' }
 */

export const SCAN_QUEUE_POLICY = Object.freeze({
  QUEUE: 'queue',
  FORCE: 'force',
})

export const SCAN_START_STATUS = Object.freeze({
  QUEUED: 'queued',
  STARTED: 'started',
  REJECTED: 'rejected',
})

/** Active statuses that block a silent second start (needs Queue vs Force).
 *
 * Case-insensitive (GT-B13). This compared against 'Running'/'Stopping'
 * exactly while its sibling isScanQueuedStatus lowercased first, so the two
 * disagreed about the same payload whenever the backend cased a status
 * differently — a lowercase 'running' job counted as neither busy nor queued. */
export function isScanBusyStatus(status) {
  const s = String(status || '').toLowerCase()
  return s === 'running' || s === 'stopping'
}

export function isScanQueuedStatus(status) {
  const s = String(status || '').toLowerCase()
  return s === 'queued' || s === 'pending' || s === 'scheduled'
}

/** True when any job in a list/payload is currently busy. */
export function hasActiveScan(jobsOrPayload) {
  const jobs = normalizeScanJobsList(jobsOrPayload)
  return jobs.some((job) => isScanBusyStatus(job?.status))
}

/** Normalize /api/scan_jobs_status (array) or ops summary scans.jobs. */
export function normalizeScanJobsList(jobsOrPayload) {
  if (Array.isArray(jobsOrPayload)) return jobsOrPayload
  if (Array.isArray(jobsOrPayload?.jobs)) return jobsOrPayload.jobs
  if (Array.isArray(jobsOrPayload?.data)) return jobsOrPayload.data
  return []
}

/**
 * Build request fields for a scan start / refresh_all retry.
 * Default (missing / unknown) is queue — never omit fields on a conflict retry.
 * @param {'queue'|'force'|string|null|undefined} [policy]
 */
export function buildScanQueueRequestFields(policy) {
  const useForce = policy === SCAN_QUEUE_POLICY.FORCE
  return {
    queue_policy: useForce ? SCAN_QUEUE_POLICY.FORCE : SCAN_QUEUE_POLICY.QUEUE,
    force_parallel: useForce,
  }
}

/** Detect legacy/already-running reject from fetch result. */
export function isAlreadyRunningReject(httpStatus, body) {
  if (httpStatus === 409) return true
  const status = String(body?.status || '').toLowerCase()
  if (status === SCAN_START_STATUS.REJECTED) {
    const msg = `${body?.message || ''} ${body?.error || ''}`.toLowerCase()
    return msg.includes('already') || msg.includes('running') || msg.includes('in progress')
  }
  const err = `${body?.error || body?.message || ''}`.toLowerCase()
  return err.includes('already running') || err.includes('already in progress')
}

/**
 * Operator-facing toast copy from Backend response field map.
 * @returns {{ text: string, variant: 'success'|'info'|'error' }}
 */
/** True when Backend coalesced this request into an existing Queued job. */
export function isScanCoalesced(body) {
  if (body?.coalesced === true) return true
  if (Number(body?.coalesced_count) > 0) return true
  if (Array.isArray(body?.jobs) && body.jobs.some((job) => job?.coalesced === true)) {
    return true
  }
  return false
}

export function toastForScanStartResponse(body, httpOk = true) {
  const status = String(body?.status || '').toLowerCase()
  const message = (body?.message || body?.error || '').trim()
  const coalescedSuffix = isScanCoalesced(body) ? ' · coalesced' : ''

  if (status === SCAN_START_STATUS.QUEUED) {
    const position =
      body?.position != null
        ? body.position
        : body?.jobs?.[0]?.position != null
          ? body.jobs[0].position
          : null
    if (position != null) {
      return { text: `Queued · position ${position}${coalescedSuffix}`, variant: 'info' }
    }
    if (body?.count != null) {
      return {
        text: message || `Queued · ${body.count} library refresh job(s)${coalescedSuffix}`,
        variant: 'info',
      }
    }
    return {
      text:
        message ||
        `Queued · waiting for the current job to finish.${coalescedSuffix ? ' (coalesced)' : ''}`,
      variant: 'info',
    }
  }
  if (status === SCAN_START_STATUS.STARTED) {
    const risk = (body?.risk || '').trim()
    const base = message || 'Scan started.'
    return {
      text: risk ? `${base} ${risk}` : base,
      variant: risk ? 'warning' : 'success',
    }
  }
  if (status === SCAN_START_STATUS.REJECTED || !httpOk) {
    return {
      text: message || body?.error || 'Scan request was rejected.',
      variant: 'error',
    }
  }
  if (httpOk && (body?.count != null || Array.isArray(body?.queued))) {
    const count = body.count ?? body.queued?.length ?? 0
    return {
      text: message || `Queued · ${count} library refresh job(s)`,
      variant: 'info',
    }
  }
  if (httpOk) {
    return { text: message || 'Scan request accepted.', variant: 'success' }
  }
  return { text: message || body?.error || 'Scan request failed.', variant: 'error' }
}

/** Map toastForScanStartResponse variant → admin showToast tone. */
export function toastToneForScanVariant(variant) {
  if (variant === 'warning') return 'warn'
  if (variant === 'error' || variant === 'danger') return 'error'
  if (variant === 'success') return 'success'
  return 'info'
}

export const SCAN_CONFLICT_COPY = Object.freeze({
  title: 'Scan in progress',
  lede: 'Another scan is already running. Queue this request (recommended) or force a parallel run.',
  queueLabel: 'Queue this scan',
  queueHint: 'Default — starts after the current job finishes (safer for Unraid/NAS load).',
  forceLabel: 'Force run now (parallel)',
  forceWarning:
    'May spike CPU and disk I/O on Unraid/NAS while two scans share the same storage. Prefer Queue unless you know the host can take the load.',
  cancelLabel: 'Cancel',
})


/**
 * Is a scan actually in progress? (GT-B13)
 *
 * The payload's `running` / `is_running` flag alone was enough to report an
 * active scan, so a stale or defaulted flag showed "Scanning…" on installs that
 * had never run one — no libraries, no jobs, no history. A flag claiming work
 * with an empty job list is describing nothing, so it needs a job to corroborate
 * it; a job with a busy status stands on its own.
 *
 * @param {object|Array} payload /api/scan_jobs_status or ops summary scans
 */
export function isScanRunning(payload) {
  const jobs = normalizeScanJobsList(payload)
  if (jobs.some((job) => isScanBusyStatus(job?.status))) return true

  const flagged = Boolean(
    payload && !Array.isArray(payload) && (payload.running || payload.is_running),
  )
  return flagged && jobs.length > 0
}
