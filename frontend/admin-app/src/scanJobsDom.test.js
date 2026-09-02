import { describe, expect, it } from 'vitest'
import {
  scanJobProgressCounts,
  scanJobsPollMs,
  scanJobsProgressSignature,
  scanJobsStructureSignature,
  unmatchedFoldersSignature,
} from '../../../oneirodex/setup/default_theme/js/scanJobsDom.js'

const running = {
  id: 'job-a',
  status: 'Running',
  folders_success: 3,
  folders_failed: 1,
  total_folders: 20,
  progress_percentage: 20,
  current_processing: '/games/one',
  library_uuid: 'lib-1',
  scan_folder: '/games',
}

describe('scan job poll signatures', () => {
  it('keeps structure stable when only progress ticks', () => {
    const later = { ...running, folders_success: 8, progress_percentage: 45, current_processing: '/games/two' }
    expect(scanJobsStructureSignature([running], { busy: true })).toBe(
      scanJobsStructureSignature([later], { busy: true }),
    )
    expect(scanJobsProgressSignature([running])).not.toBe(scanJobsProgressSignature([later]))
  })

  it('treats status / action-mode changes as a rebuild', () => {
    const done = { ...running, status: 'Completed' }
    expect(scanJobsStructureSignature([running], { busy: true })).not.toBe(
      scanJobsStructureSignature([done], { busy: false }),
    )
    expect(scanJobsStructureSignature([running], { busy: true })).not.toBe(
      scanJobsStructureSignature([running], { busy: false }),
    )
  })

  it('counts processed as successes plus failures', () => {
    expect(scanJobProgressCounts(running)).toEqual({
      success: 3,
      failed: 1,
      total: 20,
      processed: 4,
      percentage: 20,
    })
  })

  it('polls every 3s only when a live job is on the jobs pane', () => {
    expect(scanJobsPollMs({ busy: true, jobsPaneVisible: true })).toBe(3000)
    expect(scanJobsPollMs({ busy: true, jobsPaneVisible: false })).toBe(12000)
    expect(scanJobsPollMs({ busy: false, jobsPaneVisible: true })).toBe(12000)
  })

  it('does not collide when a path contains the old separators', () => {
    // A folder literally named `a|b` next to one named `a` and `b` used to
    // flatten to the same joined string, so the poller skipped the rebuild.
    const left = [{ id: 1, status: 'Unmatched', folder_path: 'a|b' }]
    const right = [{ id: 1, status: 'Unmatched|a', folder_path: 'b' }]
    expect(unmatchedFoldersSignature(left)).not.toBe(unmatchedFoldersSignature(right))

    const oneJob = [{ ...running, scan_folder: '/games;/other', library_uuid: 'lib-1' }]
    const twoJobs = [{ ...running, scan_folder: '/games' }, { ...running, scan_folder: '/other' }]
    expect(scanJobsStructureSignature(oneJob, { busy: true })).not.toBe(
      scanJobsStructureSignature(twoJobs, { busy: true }),
    )
  })

  it('keeps a server-reported 0% instead of recomputing it', () => {
    const stalledAtZero = { ...running, folders_success: 3, folders_failed: 1, progress_percentage: 0 }
    expect(scanJobProgressCounts(stalledAtZero).percentage).toBe(0)
  })

  it('computes the percentage when the server omits it', () => {
    const noReport = { ...running, progress_percentage: undefined }
    expect(scanJobProgressCounts(noReport).percentage).toBe(20)
  })

  it('skips unmatched rebuilds when the list is unchanged', () => {
    const row = { id: 9, status: 'Unmatched', folder_path: '/a', search_name: 'A' }
    expect(unmatchedFoldersSignature([row])).toBe(unmatchedFoldersSignature([{ ...row }]))
    expect(unmatchedFoldersSignature([row])).not.toBe(
      unmatchedFoldersSignature([{ ...row, status: 'Ignore' }]),
    )
  })
})
