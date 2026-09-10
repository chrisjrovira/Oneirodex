import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { mergeVisibleOrder, moveInOrder, reconcileOrder, useWidgetOrder } from './useWidgetOrder'

/**
 * The ordering rules, tested apart from React and storage.
 *
 * A saved arrangement is a user preference, not a schema — it *will* drift from
 * the code as panels are added, removed and renamed. What matters is that drift
 * never costs someone the arrangement they built, and never renders something
 * twice or not at all.
 */
describe('reconcileOrder', () => {
  test('keeps the stored arrangement when nothing has changed', () => {
    expect(reconcileOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })

  test('appends widgets the stored order has never seen', () => {
    // A newly shipped panel has to appear. Dropping it because the saved order
    // predates it would make the feature invisible to everyone who had ever
    // reordered anything.
    expect(reconcileOrder(['b', 'a'], ['a', 'b', 'new'])).toEqual(['b', 'a', 'new'])
  })

  test('drops widgets that no longer exist', () => {
    expect(reconcileOrder(['gone', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  test('collapses duplicates rather than rendering a panel twice', () => {
    expect(reconcileOrder(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  test('falls back to the declared order for junk input', () => {
    // Covers corrupt JSON, a null read, and someone hand-editing localStorage.
    for (const junk of [null, undefined, 'nonsense', 42, {}]) {
      expect(reconcileOrder(junk, ['a', 'b'])).toEqual(['a', 'b'])
    }
  })
})

describe('moveInOrder', () => {
  test('swaps with the neighbour in the given direction', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveInOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  test('clamps at the ends instead of wrapping', () => {
    // Wrapping would make a held keypress cycle the list forever, and "move up"
    // on the top item should be a no-op, not a jump to the bottom.
    const ids = ['a', 'b', 'c']
    expect(moveInOrder(ids, 'a', -1)).toBe(ids)
    expect(moveInOrder(ids, 'c', 1)).toBe(ids)
  })

  test('ignores an id that is not in the list', () => {
    const ids = ['a', 'b']
    expect(moveInOrder(ids, 'ghost', 1)).toBe(ids)
  })

  test('does not mutate the array it was given', () => {
    const ids = ['a', 'b', 'c']
    moveInOrder(ids, 'a', 1)
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeVisibleOrder', () => {
  test('reorders the visible widgets without disturbing absent ones', () => {
    // 'gone' has no data right now, so it is not in knownIds and renders
    // nothing — but it keeps its slot at the front.
    expect(mergeVisibleOrder(['gone', 'a', 'b'], ['b', 'a'], ['a', 'b'])).toEqual([
      'gone',
      'b',
      'a',
    ])
  })

  test('appends ids the stored preference has never seen', () => {
    expect(mergeVisibleOrder([], ['b', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })

  test('collapses a duplicate rather than carrying it forward', () => {
    expect(mergeVisibleOrder(['a', 'a', 'b'], ['b', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })
})

describe('useWidgetOrder', () => {
  /**
   * The regression this hook was rewritten for.
   *
   * State used to be the *rendered* list, re-reconciled against itself when the
   * known set changed — so a widget whose data briefly went away was dropped
   * outright, and came back appended at the end. localStorage still held the
   * real arrangement but is only read on mount, so the arrangement someone
   * built rearranged itself until they reloaded the page.
   *
   * localStorage is unavailable in this environment, which makes the test
   * stronger rather than weaker: the position has to survive in memory alone.
   */
  test('a widget that disappears and returns keeps its place', () => {
    const { result, rerender } = renderHook(({ known }) => useWidgetOrder('test-surface', known), {
      initialProps: { known: ['a', 'b', 'c'] },
    })

    act(() => result.current.move('c', -1))
    expect(result.current.ids).toEqual(['a', 'c', 'b'])

    // 'c' loses its data and stops rendering.
    rerender({ known: ['a', 'b'] })
    expect(result.current.ids).toEqual(['a', 'b'])

    // ...and comes back to the slot it was put in, not to the end.
    rerender({ known: ['a', 'b', 'c'] })
    expect(result.current.ids).toEqual(['a', 'c', 'b'])
  })

  test('a genuinely new widget still arrives at the end', () => {
    const { result, rerender } = renderHook(({ known }) => useWidgetOrder('test-surface', known), {
      initialProps: { known: ['a', 'b'] },
    })

    act(() => result.current.move('b', -1))
    expect(result.current.ids).toEqual(['b', 'a'])

    rerender({ known: ['a', 'b', 'shipped-later'] })
    expect(result.current.ids).toEqual(['b', 'a', 'shipped-later'])
  })

  test('reset returns to the declared order', () => {
    const { result } = renderHook(() => useWidgetOrder('test-surface', ['a', 'b', 'c']))

    act(() => result.current.move('c', -1))
    expect(result.current.isCustom).toBe(true)

    act(() => result.current.reset())
    expect(result.current.ids).toEqual(['a', 'b', 'c'])
    expect(result.current.isCustom).toBe(false)
  })
})

describe('isCustom', () => {
  test('is false for the declared order and true once it differs', () => {
    // Drives whether a "Reset order" control is offered at all — the same
    // reasoning as disabling a move at the ends rather than hiding it: never
    // show a control that cannot do anything.
    const known = ['a', 'b', 'c']
    expect(reconcileOrder(null, known).join('|') !== known.join('|')).toBe(false)
    expect(moveInOrder(known, 'a', 1).join('|') !== known.join('|')).toBe(true)
  })
})
