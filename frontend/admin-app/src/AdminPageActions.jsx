import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const SLOT_ID = 'gt-admin-topbar-slot'

/**
 * Page actions in the admin top bar (W33-9).
 *
 * Identity already lives in the rail. Buttons that used to sit in
 * `.gt-admin-actions-row` on the page belong beside the page name, the same
 * leftover UIR-3/UIR-7 named on the member side. Portals into
 * `#gt-admin-topbar-slot` when the shell is present; falls back to the inline
 * row in tests and any host without the bar.
 */
export function AdminPageActions({ children, label = 'Page actions' }) {
  const [slot, setSlot] = useState(null)

  useEffect(() => {
    setSlot(document.getElementById(SLOT_ID))
  }, [])

  const cluster = (
    <div className="gt-cbtn-group" role="group" aria-label={label}>
      {children}
    </div>
  )

  if (slot) {
    return createPortal(cluster, slot)
  }

  return <div className="gt-admin-actions-row">{children}</div>
}
