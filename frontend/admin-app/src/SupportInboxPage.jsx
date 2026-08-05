import { useEffect, useState } from 'react'
import { DataTable } from './DataTable'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export function SupportInboxPage() {
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState(null)

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
    await fetch(`/api/support/tickets/${id}/resolve`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
    })
    await load()
  }

  if (error) {
    return (
      <div className="gt-adminpage">
        <p role="alert">Unable to load support tickets.</p>
      </div>
    )
  }

  return (
    <div className="gt-adminpage">
      <h1>Support inbox</h1>
      <p>Teammate reports from the member app. GitHub Issues when SUPPORT_GITHUB_TOKEN is set.</p>
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
