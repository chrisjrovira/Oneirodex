// Toasts on every mutation (GT-B25).
import { useEffect, useState } from 'react'
import { PageStatus } from './PageStatus'
import { DataTable } from './DataTable'
import { MetricStrip } from './opsWidgets'
import { csrfHeaders } from './adminApi'
import { showToast } from './utils/toast'

export function SupportInboxPage() {
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState(null)

  // Derived rather than stored: a second piece of state would be one more thing
  // to keep in step with the list it counts.
  const openCount = tickets.filter((t) => t.status === 'open').length
  const syncedCount = tickets.filter((t) => t.github_issue_number).length

  function load() {
    return fetch('/api/support/tickets', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Support ${response.status}`)
        return response.json()
      })
      .then((data) => setTickets(Array.isArray(data.tickets) ? data.tickets : []))
      .catch((err) => setError(err))
  }

  useEffect(() => {
    load()
  }, [])

  async function resolve(id) {
    // Resolving used to give no feedback at all — the row simply vanished on
    // reload, which is indistinguishable from the click not registering.
    try {
      const response = await fetch(`/api/support/tickets/${id}/resolve`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders(),
      })
      if (!response.ok) {
        throw new Error(`resolve failed (${response.status})`)
      }
      showToast('Ticket resolved.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not resolve the ticket.', 'error')
    }
    await load()
  }

  if (error) {
    return (
      <div className="gt-adminpage">
        <PageStatus error errorMessage="Unable to load support tickets." />
      </div>
    )
  }

  return (
    <div className="gt-adminpage">
      <h1>Support inbox</h1>
      <p>Teammate reports from the member app. GitHub Issues when SUPPORT_GITHUB_TOKEN is set.</p>
      {/* UID-014 — the strip exists so every admin page answers "how bad is it"
          before you read the table. Open is the number that decides whether
          this page needs you, so it carries the tone; the totals are context
          and stay neutral. */}
      <MetricStrip
        label="Support"
        items={[
          {
            id: 'open',
            label: 'Open',
            value: openCount,
            hint: 'awaiting a reply',
            tone: openCount === 0 ? 'good' : openCount >= 10 ? 'action' : 'warning',
          },
          {
            id: 'resolved',
            label: 'Resolved',
            value: tickets.length - openCount,
            hint: 'closed tickets',
            tone: 'info',
          },
          {
            id: 'synced',
            label: 'On GitHub',
            value: syncedCount,
            hint: 'mirrored as issues',
            tone: 'info',
          },
        ]}
      />
      <DataTable
        columns={[
          { key: 'id', label: 'ID', align: 'right' },
          { key: 'severity', label: 'Sev' },
          { key: 'area', label: 'Area' },
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' },
          {
            key: 'github',
            label: 'GitHub',
            // Sorts on the issue number, not the rendered link markup.
            value: (t) => t.github_issue_number ?? t.github_sync,
            render: (t) =>
              t.github_issue_url ? (
                <a href={t.github_issue_url} target="_blank" rel="noopener noreferrer">
                  #{t.github_issue_number}
                </a>
              ) : (
                t.github_sync
              ),
          },
          {
            key: 'actions',
            label: '',
            sortable: false,
            filterable: false,
            render: (t) =>
              t.status === 'open' ? (
                <button type="button" className="gt-btn" onClick={() => void resolve(t.id)}>
                  Resolve
                </button>
              ) : null,
          },
        ]}
        rows={tickets}
        getRowKey={(t) => t.id}
        emptyMessage="No tickets yet."
        dense
      />
    </div>
  )
}
