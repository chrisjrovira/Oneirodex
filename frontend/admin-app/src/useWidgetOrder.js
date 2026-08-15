import { useCallback, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'gt-widget-order:'

/**
 * Reconcile a stored order against the widgets that actually exist.
 *
 * Stored order is a user preference, not a schema, so it will drift from the
 * code: a release adds a panel, removes one, or renames an id. Three rules keep
 * that harmless —
 *
 *   - ids the code no longer knows are dropped, so a removed panel cannot leave
 *     a hole or resurrect itself;
 *   - ids the storage does not mention are appended in their declared order, so
 *     a newly shipped panel shows up at the end rather than vanishing;
 *   - duplicates collapse, because a corrupted entry should not render the same
 *     panel twice.
 *
 * The alternative — treating a mismatch as "reset to defaults" — throws away an
 * arrangement someone built every time we ship a new widget.
 */
export function reconcileOrder(storedIds, knownIds) {
  const known = new Set(knownIds)
  const seen = new Set()
  const ordered = []

  for (const id of Array.isArray(storedIds) ? storedIds : []) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  for (const id of knownIds) {
    if (!seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  return ordered
}

/** Swap the item at `index` with its neighbour `delta` away. */
export function moveInOrder(ids, id, delta) {
  const from = ids.indexOf(id)
  if (from < 0) return ids
  const to = from + delta
  // Clamped rather than wrapped: a "move up" on the first item should do
  // nothing, not send it to the bottom. Wrapping makes a held keypress cycle
  // the list forever.
  if (to < 0 || to >= ids.length) return ids

  const next = [...ids]
  next[from] = ids[to]
  next[to] = ids[from]
  return next
}

/**
 * Fold a reordered *visible* sequence back into the saved preference.
 *
 * The preference is a superset of what is on screen: a panel whose data is
 * absent renders nothing but keeps its place in the arrangement. Rewriting the
 * preference as just the visible order would throw those absent ids away, and
 * they would come back appended at the end — which is the arrangement someone
 * built quietly rearranging itself because a panel blinked.
 *
 * So the walk preserves slots: every position currently held by a rendered
 * widget takes the next id from the new visible order, and positions held by
 * absent ones are left exactly where they are.
 */
export function mergeVisibleOrder(preferred, visibleOrder, knownIds) {
  const known = new Set(knownIds)
  const queue = [...visibleOrder]
  const merged = []
  const seen = new Set()

  for (const id of Array.isArray(preferred) ? preferred : []) {
    if (seen.has(id)) continue
    if (known.has(id)) {
      const next = queue.shift()
      if (next !== undefined && !seen.has(next)) {
        seen.add(next)
        merged.push(next)
      }
    } else {
      seen.add(id)
      merged.push(id)
    }
  }
  // Anything the stored preference never mentioned — a newly shipped panel, or
  // the first move made on a default arrangement.
  for (const id of queue) {
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(id)
  }
  return merged
}


function readStored(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Corrupt or unavailable storage falls back to the declared order rather
    // than breaking the page it decorates.
    return null
  }
}

/**
 * Per-surface widget order, persisted locally (W27 / UID-014 follow-on).
 *
 * localStorage rather than the preferences API on purpose: this is a per-device
 * arrangement, and an admin on a laptop and a wall display want different ones.
 * Promoting it to a saved server-side preset is the natural next step, and
 * `reconcileOrder` is deliberately independent of storage so that move does not
 * touch the ordering rules.
 */
export function useWidgetOrder(surface, knownIds) {
  const key = `${STORAGE_PREFIX}${surface}`

  // State is the *preference*, not the rendered list, and it is deliberately a
  // superset: it keeps ids that are not currently known so a panel whose data
  // is briefly absent returns to its saved slot instead of to the end.
  //
  // This used to be the rendered list, re-reconciled against itself whenever
  // the known set changed. That dropped an absent id from memory outright —
  // localStorage still held the real arrangement, but it was only ever read on
  // mount, so a panel that blinked lost its position until a page reload. The
  // docstring above already promised the saved order survives that; now it
  // does.
  const [preferred, setPreferred] = useState(() => {
    const stored = readStored(key)
    return Array.isArray(stored) ? stored : []
  })

  // Derived rather than stored, so there is no second copy to keep in step and
  // no effect that can miss a change.
  const knownKey = knownIds.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ids = useMemo(() => reconcileOrder(preferred, knownIds), [preferred, knownKey])

  const persist = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // A full or disabled store must not stop the move from taking effect
        // for this session.
      }
    },
    [key],
  )

  const move = useCallback(
    (id, delta) => {
      setPreferred((current) => {
        const visible = reconcileOrder(current, knownIds)
        const next = moveInOrder(visible, id, delta)
        if (next === visible) return current
        const merged = mergeVisibleOrder(current, next, knownIds)
        persist(merged)
        return merged
      })
    },
    [persist, knownKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const reset = useCallback(() => {
    setPreferred([])
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }, [key])

  // Whether the arrangement has actually been changed. Drives an offer to undo
  // it: a "Reset order" control on a console nobody has reordered is a button
  // that does nothing, taking up room in chrome this redesign spent the whole
  // wave thinning out.
  const isCustom = ids.join('|') !== knownIds.join('|')

  return { ids, move, reset, isCustom }
}
