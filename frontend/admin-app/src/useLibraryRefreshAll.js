import { useCallback, useState } from 'react'
import { postJsonResult } from './adminApi'
import {
  buildScanQueueRequestFields,
  hasActiveScan,
  isAlreadyRunningReject,
  normalizeScanJobsList,
  toastForScanStartResponse,
  toastToneForScanVariant,
} from './scanQueuePolicy'
import { showToast } from './utils/toast'

const REFRESH_ALL_URL = '/api/admin/libraries/refresh_all'
const SCAN_STATUS_URL = '/api/scan_jobs_status'

/**
 * Refresh-all libraries with Queue (default) / Force conflict modal wiring.
 * Always sends `queue_policy` + `force_parallel` on the POST (idle default = queue).
 */
export function useLibraryRefreshAll() {
  const [conflictOpen, setConflictOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const postRefresh = useCallback(async (policy) => {
    // null = operator has not chosen yet (idle path or legacy 409 recovery) → default queue fields.
    const fields = buildScanQueueRequestFields(
      policy == null ? undefined : policy,
    )
    setBusy(true)
    try {
      const { ok, status, data } = await postJsonResult(REFRESH_ALL_URL, fields)
      if (isAlreadyRunningReject(status, data) && policy == null) {
        setConflictOpen(true)
        return { deferred: true }
      }
      const toast = toastForScanStartResponse(data, ok)
      showToast(toast.text, toastToneForScanVariant(toast.variant))
      setConflictOpen(false)
      return { ok, status, data, deferred: false }
    } catch (err) {
      showToast(err?.message || 'Refresh all failed.', 'error')
      setConflictOpen(false)
      return { ok: false, deferred: false, error: err }
    } finally {
      setBusy(false)
    }
  }, [])

  const startRefreshAll = useCallback(async () => {
    if (
      !window.confirm(
        'Refresh all libraries using each library’s last scan folder?',
      )
    ) {
      return
    }
    try {
      const response = await fetch(SCAN_STATUS_URL, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (response.status === 401) {
        window.location.href = '/login'
        throw new Error('unauthorized')
      }
      const payload = response.ok ? await response.json().catch(() => []) : []
      const jobs = normalizeScanJobsList(payload)
      if (hasActiveScan(jobs)) {
        setConflictOpen(true)
        return
      }
      await postRefresh(null)
    } catch (err) {
      showToast(err?.message || 'Could not check scan status.', 'error')
    }
  }, [postRefresh])

  const onConflictChoose = useCallback(
    (policy) => {
      void postRefresh(policy)
    },
    [postRefresh],
  )

  const onConflictClose = useCallback(() => {
    if (!busy) setConflictOpen(false)
  }, [busy])

  return {
    conflictOpen,
    refreshing: busy,
    startRefreshAll,
    onConflictChoose,
    onConflictClose,
  }
}
