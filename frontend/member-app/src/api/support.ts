/**
 * Member support tickets — the "Report an issue / an idea" form.
 *
 * Was a bare `fetch()` in ReportIssuePage's submit handler. Moved here in wave
 * B1.4 so it goes through `src/api/` and reports failures through the shared
 * envelope builder.
 */
import { csrfHeaders, errorFromResponse } from '@oneirodex/ui'

export async function submitSupportTicket(payload: any) {
  const response = await fetch('/api/support/tickets', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Submit failed')
  }
  return response.json().catch(() => ({}))
}
