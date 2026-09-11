import { describe, expect, it } from 'vitest'
import { OneirodexApiError } from './client.js'
import { harness, okEnvelope } from './test-harness.js'

describe('library api', () => {
  it('list hits GET /api/get_libraries', async () => {
    const { calls, client } = harness(200, okEnvelope({ libraries: [{ uuid: 'l1', name: 'PS2' }] }))
    const res = await client.library.list()
    expect(calls[0]).toMatchObject({ url: 'https://host.example/api/get_libraries', method: 'GET' })
    expect(res.libraries?.[0].uuid).toBe('l1')
  })

  it('setWatch PUTs { watch_enabled } and surfaces a 403', async () => {
    const { calls, client } = harness(403, {
      ok: false,
      error: 'Librarian or admin required',
      error_code: 'forbidden',
    })
    await expect(client.library.setWatch('l1', true)).rejects.toBeInstanceOf(OneirodexApiError)
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/library/l1/watch',
      method: 'PUT',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ watch_enabled: true })
  })

  it('startScan POSTs the scan body to /api/admin/libraries/scan', async () => {
    const { calls, client } = harness(
      200,
      okEnvelope({ status: 'queued', job_id: 'job-1', position: 2 }),
    )
    const res = await client.library.startScan({
      library_uuid: 'l1',
      folder: '/storage/pc',
      queue_policy: 'queue',
      force_parallel: false,
    })
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/admin/libraries/scan',
      method: 'POST',
    })
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({
      library_uuid: 'l1',
      folder: '/storage/pc',
      queue_policy: 'queue',
    })
    expect(res.job_id).toBe('job-1')
  })

  it('startScan surfaces an already-running 409', async () => {
    const { client } = harness(409, {
      ok: false,
      error: 'A scan is already running for this library',
      error_code: 'conflict',
    })
    await expect(
      client.library.startScan({ library_uuid: 'l1', queue_policy: 'force' }),
    ).rejects.toMatchObject({ status: 409, error_code: 'conflict' })
  })

  it('batchScan and batchEdit POST to their batch routes', async () => {
    const { calls, client } = harness(200, okEnvelope({ message: 'Queued 2 scans.' }))
    await client.library.batchScan({ library_uuids: ['l1', 'l2'], queue_policy: 'queue' })
    expect(calls[0]).toMatchObject({ url: 'https://host.example/api/admin/libraries/batch/scan' })

    await client.library.batchEdit({ library_uuids: ['l1'], group_name: 'Retro' })
    expect(calls[1]).toMatchObject({ url: 'https://host.example/api/admin/libraries/batch/edit' })
    expect(JSON.parse(calls[1].body ?? '{}')).toEqual({
      library_uuids: ['l1'],
      group_name: 'Retro',
    })
  })

  it('refreshAll defaults to an empty body and getScanJobsStatus GETs the job list', async () => {
    const { calls, client } = harness(200, okEnvelope({ status: 'queued', count: 3 }))
    await client.library.refreshAll()
    expect(calls[0]).toMatchObject({
      url: 'https://host.example/api/admin/libraries/refresh_all',
      method: 'POST',
    })
    expect(calls[0].body).toBe('{}')

    const jobs = harness(200, [{ id: 'j1', status: 'Running' }])
    const rows = await jobs.client.library.getScanJobsStatus()
    expect(jobs.calls[0]).toMatchObject({
      url: 'https://host.example/api/scan_jobs_status',
      method: 'GET',
    })
    expect(rows[0].id).toBe('j1')
  })
})
