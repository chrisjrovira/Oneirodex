/**
 * Cap the live toast stack so a scan burst cannot cover the page.
 *
 * Five info/success toasts stay individual. A sixth (or a burst already over
 * five) collapses to one “N notifications” line. Errors and warnings never
 * join that stack — they still need their own sentence.
 */

export const MAX_INDIVIDUAL_TOASTS = 5

export type ToastTone = 'info' | 'success' | 'error' | 'warn'

export interface ToastStackState {
  stackedCount?: number
  hasSummary?: boolean
  incomingCount?: number
}

export type ToastStackPlan =
  | { action: 'append' }
  | { action: 'increment-summary'; add: number }
  | { action: 'collapse'; nextCount: number }

export function stackSummaryMessage(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  return `${n} notification${n === 1 ? '' : 's'}`
}

export function isStackableTone(tone: string): boolean {
  return tone === 'info' || tone === 'success'
}

export function planToastStack({
  stackedCount = 0,
  hasSummary = false,
  incomingCount = 1,
}: ToastStackState = {}): ToastStackPlan {
  const incoming = incomingCount > 0 ? incomingCount : 1
  const current = stackedCount > 0 ? stackedCount : 0
  if (hasSummary) {
    return { action: 'increment-summary', add: incoming }
  }
  if (current + incoming > MAX_INDIVIDUAL_TOASTS) {
    return { action: 'collapse', nextCount: current + incoming }
  }
  return { action: 'append' }
}
