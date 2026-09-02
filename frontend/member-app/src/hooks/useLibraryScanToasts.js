import { useEffect } from 'react'
import {
  burstToastMessages,
  groupLibraryScanToasts,
  markLibraryScanToastSeen,
  pickUnseenLibraryScanToasts,
} from '../utils/libraryScanNotify'
import { showToast } from '../utils/toast'

const POLL_MS = 45000

/**
 * Soft-poll notifications for incremental library adds → top-right toast.
 * Silent when the endpoint is missing or the event kind is not ready yet.
 */
export function useLibraryScanToasts({ enabled = true, intervalMs = POLL_MS } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return undefined
    }

    let cancelled = false
    let timer = 0

    async function poll() {
      try {
        const res = await fetch('/api/notifications?limit=20', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (cancelled || !res.ok) {
          return
        }
        const data = await res.json().catch(() => null)
        const rows = Array.isArray(data?.notifications)
          ? data.notifications
          : Array.isArray(data)
            ? data
            : []
        // One toast per library, not per increment (GT-B11). More than five
        // libraries collapse to “N notifications” so a FIFO drain cannot cover
        // the page. Every row in a burst is marked seen so it cannot re-toast.
        for (const burst of burstToastMessages(
          groupLibraryScanToasts(pickUnseenLibraryScanToasts(rows)),
        )) {
          if (burst.count > 1) {
            showToast(burst.message, 'success', { count: burst.count })
          } else {
            showToast(burst.message, 'success')
          }
          for (const row of burst.rows) {
            markLibraryScanToastSeen(row.id ?? row.uuid ?? row.created_at ?? row.title)
          }
        }
      } catch {
        // Soft-fail — Backend event may not be wired yet.
      }
    }

    void poll()
    timer = window.setInterval(() => {
      void poll()
    }, intervalMs)

    function onFocus() {
      void poll()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, intervalMs])
}
