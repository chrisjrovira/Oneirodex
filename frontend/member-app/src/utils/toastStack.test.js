import { describe, expect, it } from 'vitest'

import { MAX_INDIVIDUAL_TOASTS, planToastStack, stackSummaryMessage } from '../../../shared/toastStack'

describe('planToastStack', () => {
  it('lets five individual toasts through', () => {
    expect(
      planToastStack({ stackedCount: 4, incomingCount: 1 }),
    ).toEqual({ action: 'append' })
    expect(MAX_INDIVIDUAL_TOASTS).toBe(5)
  })

  it('collapses when the sixth would appear', () => {
    expect(planToastStack({ stackedCount: 5, incomingCount: 1 })).toEqual({
      action: 'collapse',
      nextCount: 6,
    })
  })

  it('collapses a burst already over the cap', () => {
    expect(planToastStack({ stackedCount: 0, incomingCount: 12 })).toEqual({
      action: 'collapse',
      nextCount: 12,
    })
  })

  it('increments an existing summary instead of stacking beside it', () => {
    expect(planToastStack({ stackedCount: 6, hasSummary: true, incomingCount: 3 })).toEqual({
      action: 'increment-summary',
      add: 3,
    })
  })
})

describe('stackSummaryMessage', () => {
  it('names the count', () => {
    expect(stackSummaryMessage(6)).toBe('6 notifications')
    expect(stackSummaryMessage(1)).toBe('1 notification')
  })
})
