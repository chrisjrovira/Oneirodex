import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'od-rail-state'
const MOBILE_QUERY = '(max-width: 900px)'

/**
 * Rail open/collapsed state, shared by both shells (GT-B2).
 *
 * Lives in frontend/shared rather than in either app because member-app and
 * admin-app are separate Vite builds that cannot import from one another. The
 * rail behaves identically in both, and a copy in each would be two things to
 * keep in step — exactly the pattern the GT-A4 button work was undoing.
 * Imported by relative path; there is no package boundary to set up.
 *
 * The rail has three states, not two, and they do not mean the same thing on
 * every viewport:
 *
 *   expanded   desktop default — icons plus labels
 *   collapsed  desktop, icon-only strip; labels stay in the a11y tree
 *   open       mobile only — the drawer is showing over the content
 *
 * Keeping "collapsed" and "open" as one attribute value would make the mobile
 * drawer inherit whatever the user last chose on desktop, so a member who
 * collapsed the rail on a laptop would find the phone drawer showing bare
 * icons. They are separate here, and the stylesheet re-expands labels under the
 * mobile breakpoint regardless of the persisted desktop preference.
 *
 * Only the desktop preference is persisted. A drawer that reopened itself on
 * next load because it was open when you navigated away would be a bug.
 */
export function useRailState() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'collapsed'
    } catch {
      // Private mode / disabled storage must not break navigation.
      return false
    }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded')
    } catch {
      /* not fatal — the rail just will not remember */
    }
  }, [collapsed])

  // Close the drawer when the viewport grows past the breakpoint, or it stays
  // "open" invisibly and the next mobile resize flashes it back in.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(MOBILE_QUERY)
    function onChange(event) {
      if (!event.matches) setDrawerOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Escape closes the drawer — it is a modal overlay on mobile.
  useEffect(() => {
    if (!drawerOpen) return undefined
    function onKey(event) {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const toggle = useCallback(() => {
    // One button drives both behaviours: on mobile it opens the drawer, on
    // desktop it collapses. Deciding here rather than in the component keeps
    // both shells from re-implementing the branch.
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia?.(MOBILE_QUERY).matches
    if (isMobile) setDrawerOpen((open) => !open)
    else setCollapsed((value) => !value)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  /** Value for the shell's data-rail attribute. */
  const railState = drawerOpen ? 'open' : collapsed ? 'collapsed' : 'expanded'

  return { collapsed, drawerOpen, railState, toggle, closeDrawer }
}
