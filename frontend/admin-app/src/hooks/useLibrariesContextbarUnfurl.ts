import { useLayoutEffect } from 'react'

/**
 * Libraries & scans no longer emit a sibling strip that needs collapsing.
 *
 * Scan's THN is a flat Auto | Manual pair; other destinations live in the LHN
 * only. Kept as a no-op so App.tsx and tests can stay wired without rewriting
 * Jinja segments into unfurl menus (which would hide Auto/Manual again).
 */
export function useLibrariesContextbarUnfurl(enabled: boolean) {
  useLayoutEffect(() => {
    void enabled
  }, [enabled])
}
