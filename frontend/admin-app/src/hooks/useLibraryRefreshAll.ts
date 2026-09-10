import { useCallback, useState } from 'react'
import { confirmAction } from '@oneirodex/ui'
import { postJsonResult } from '../api/adminApi'
import {
  buildScanQueueRequestFields,
  hasActiveScan,
  isAlreadyRunningReject,
  normalizeScanJobsList,
  toastForScanStartResponse,
  toastToneForScanVariant,
} from '../components/scanQueuePolicy'
import type { ScanQueuePolicy } from '../components/scanQueuePolicy'
import { showToast } from '../utils/toast'
import { errorText } from '../utils/errorText'

const REFRESH_ALL_URL = '/api/admin/libraries/refresh_all'
const SCAN_STATUS_URL = '/api/scan_jobs_status'

/**
 * Refresh-all libraries with Queue (default) / Force conflict modal wiring.
 * Always sends `queue_policy` + `force_parallel` on the POST (idle default = queue).
 */
export function useLibraryRefreshAll() {
  const [conflictOpen, setConflictOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const postRefresh = useCallback(async (policy: ScanQueuePolicy | null) => {
    // null = operator has not chosen yet (idle path or legacy 409 recovery) → default queue fields.
    const fields = buildScanQueueRequestFields(policy == null ? undefined : policy)
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
      showToast(errorText(err) || 'Refresh all failed.', 'error')
      setConflictOpen(false)
      return { ok: false, deferred: false, error: err }
    } finally {
      setBusy(false)
    }
  }, [])

  const startRefreshAll = useCallback(async () => {
    const ok = await confirmAction({
      title: 'Refresh all libraries?',
      body: 'Each library is rescanned using its own last scan folder.',
      confirmLabel: 'Refresh all',
      tone: 'neutral',
    })
    if (!ok) {
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
      showToast(errorText(err) || 'Could not check scan status.', 'error')
    }
  }, [postRefresh])

  const onConflictChoose = useCallback(
    (policy: ScanQueuePolicy) => {
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
