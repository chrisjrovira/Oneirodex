import { useEffect, useState } from 'react'

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
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Sev</th>
            <th>Area</th>
            <th>Title</th>
            <th>Status</th>
            <th>GitHub</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.severity}</td>
              <td>{t.area}</td>
              <td>{t.title}</td>
              <td>{t.status}</td>
              <td>
                {t.github_issue_url ? (
                  <a href={t.github_issue_url} target="_blank" rel="noopener noreferrer">
                    #{t.github_issue_number}
                  </a>
                ) : (
                  t.github_sync
                )}
              </td>
              <td>
                {t.status === 'open' ? (
                  <button type="button" className="gt-btn" onClick={() => void resolve(t.id)}>
                    Resolve
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tickets.length === 0 ? <p>No tickets yet.</p> : null}
    </div>
  )
}
