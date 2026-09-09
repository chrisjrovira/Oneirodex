import { errorFromResponse } from '@oneirodex/ui'

export async function fetchOpsSummary({ signal } = {}) {
  const response = await fetch('/admin/api/ops/summary', {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    // Was a bare `throw new Error('Ops summary failed: ' + status)` — the body
    // was never read, so PageStatus showed a developer string as the headline.
    // The shared builder reads the envelope once and keeps `status` /
    // `error_code` on the Error for resolveErrorDetail.
    throw await errorFromResponse(response, 'ops summary')
  }

  return response.json()
}
