/**
 * Normalize Backend batch list fields (uuid strings or { uuid } objects).
 * @param {unknown} list
 * @returns {number}
 */
export function countBatchItems(list) {
  return Array.isArray(list) ? list.length : 0
}

/**
 * @param {unknown} list
 * @returns {string[]}
 */
export function batchItemUuids(list) {
  if (!Array.isArray(list)) {
    return []
  }
  const out = []
  for (const item of list) {
    if (typeof item === 'string' && item) {
      out.push(item)
      continue
    }
    if (item && typeof item === 'object' && typeof item.uuid === 'string' && item.uuid) {
      out.push(item.uuid)
    }
  }
  return out
}

/**
 * Honest partial-success toast copy from `{ updated|queued, skipped, errors }`.
 *
 * @param {{ updated?: unknown, queued?: unknown, skipped?: unknown, errors?: unknown } | null | undefined} outcome
 * @param {{ actionLabel?: string, successVerb?: string, t?: (s: string) => string }} [options]
 * @returns {{ message: string, tone: 'success'|'warn'|'error'|'info', updated: number, skipped: number, errors: number }}
 */
export function summarizeBatchOutcome(outcome, options = {}) {
  const t = options.t || ((s) => s)
  const successList =
    outcome?.updated !== undefined && outcome?.updated !== null
      ? outcome.updated
      : outcome?.queued
  const updated = countBatchItems(successList)
  const skipped = countBatchItems(outcome?.skipped)
  const errors = countBatchItems(outcome?.errors)
  const successVerb = options.successVerb || 'updated'
  const counts = t(`${updated} ${successVerb} · ${skipped} skipped · ${errors} failed`)
  const message = options.actionLabel
    ? t(`${options.actionLabel}: ${counts}`)
    : counts

  let tone = 'success'
  if (errors > 0 && updated === 0) {
    tone = 'error'
  } else if (errors > 0) {
    tone = 'warn'
  } else if (updated === 0 && skipped > 0) {
    tone = 'info'
  }

  return { message, tone, updated, skipped, errors }
}
