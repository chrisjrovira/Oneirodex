import { describe, expect, test } from 'vitest'
import {
  SCAN_CONFLICT_COPY,
  SCAN_QUEUE_POLICY,
  buildScanQueueRequestFields,
  hasActiveScan,
  isAlreadyRunningReject,
  isScanBusyStatus,
  isScanQueuedStatus,
  normalizeScanJobsList,
  toastForScanStartResponse,
} from './scanQueuePolicy'

describe('scanQueuePolicy', () => {
  test('buildScanQueueRequestFields defaults queue and maps force', () => {
    expect(buildScanQueueRequestFields(SCAN_QUEUE_POLICY.QUEUE)).toEqual({
      queue_policy: 'queue',
      force_parallel: false,
    })
    expect(buildScanQueueRequestFields(SCAN_QUEUE_POLICY.FORCE)).toEqual({
      queue_policy: 'force',
      force_parallel: true,
    })
  })

  test('busy and queued status helpers', () => {
    expect(isScanBusyStatus('Running')).toBe(true)
    expect(isScanBusyStatus('Stopping')).toBe(true)
    expect(isScanBusyStatus('Queued')).toBe(false)
    expect(isScanQueuedStatus('Queued')).toBe(true)
    expect(isScanQueuedStatus('pending')).toBe(true)
    expect(isScanQueuedStatus('Running')).toBe(false)
  })

  test('hasActiveScan reads array or jobs payload', () => {
    expect(hasActiveScan([{ status: 'Completed' }, { status: 'Running' }])).toBe(true)
    expect(hasActiveScan({ jobs: [{ status: 'Queued' }] })).toBe(false)
    expect(normalizeScanJobsList({ jobs: [{ id: '1' }] })).toHaveLength(1)
  })

  test('isAlreadyRunningReject covers 409 and rejected copy', () => {
    expect(isAlreadyRunningReject(409, { error: 'A scan is already running' })).toBe(true)
    expect(
      isAlreadyRunningReject(200, {
        status: 'rejected',
        message: 'A scan is already in progress',
      }),
    ).toBe(true)
    expect(isAlreadyRunningReject(200, { status: 'queued' })).toBe(false)
  })

  test('toastForScanStartResponse maps queued|started|rejected', () => {
    expect(toastForScanStartResponse({ status: 'queued', position: 2 }).variant).toBe('info')
    expect(toastForScanStartResponse({ status: 'queued', position: 2 }).text).toMatch(/position 2/)
    expect(toastForScanStartResponse({ status: 'started' }).variant).toBe('success')
    expect(
      toastForScanStartResponse({ status: 'started', message: 'Scan started.', risk: 'NAS risk' })
        .variant,
    ).toBe('warning')
    expect(
      toastForScanStartResponse({ status: 'started', message: 'Scan started.', risk: 'NAS risk' })
        .text,
    ).toMatch(/NAS risk/)
    expect(toastForScanStartResponse({ status: 'rejected', error: 'Nope' }, false).text).toBe('Nope')
    expect(toastForScanStartResponse({ count: 3 }, true).text).toMatch(/Queued 3/)
  })

  test('conflict copy stays honest about Unraid/NAS load', () => {
    expect(SCAN_CONFLICT_COPY.forceWarning).toMatch(/Unraid\/NAS/)
    expect(SCAN_CONFLICT_COPY.queueHint).toMatch(/safer/)
  })
})
