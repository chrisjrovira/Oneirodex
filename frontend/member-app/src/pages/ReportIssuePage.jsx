import { useState } from 'react'
import { Link } from 'react-router-dom'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

const AREAS = [
  'auth', 'library', 'download', 'webretro', 'companion', 'acquire',
  'social', 'themes', 'admin', 'oidc', 'security', 'other',
]

export function ReportIssuePage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [area, setArea] = useState('other')
  const [severity, setSeverity] = useState('P2')
  const [deploy, setDeploy] = useState('Unraid')
  const [client, setClient] = useState('')
  const [url, setUrl] = useState('')
  const [logs, setLogs] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken(),
        },
        body: JSON.stringify({
          title,
          body,
          area,
          severity,
          deploy_hint: deploy,
          client_hint: client,
          url_hint: url,
          logs,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Submit failed')
      setResult(data.ticket)
      setTitle('')
      setBody('')
      setLogs('')
    } catch (err) {
      setError(err.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Report issue</h1>
      </div>
      <p className="gt-more-page__lede">
        Files a ticket for maintainers. Syncs to GitHub Issues when configured; admins are notified in-app.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <p>
          Ticket #{result.id} saved
          {result.github_sync === 'synced' && result.github_issue_url ? (
            <>
              {' · '}
              <a href={result.github_issue_url} target="_blank" rel="noopener noreferrer">
                GitHub #{result.github_issue_number}
              </a>
            </>
          ) : null}
          {result.github_sync === 'skipped' ? ' · GitHub sync skipped (token not set)' : null}
          {result.github_sync === 'error' ? ' · GitHub sync failed (ticket kept)' : null}
          {' · '}
          <Link to="/notifications">Notifications</Link>
        </p>
      ) : null}
      <form className="gt-updates__search-form" onSubmit={submit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Symptom
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} />
        </label>
        <label>
          Area
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {['P0', 'P1', 'P2', 'P3'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Deploy
          <select value={deploy} onChange={(e) => setDeploy(e.target.value)}>
            {['Unraid', 'Compose', 'native', 'other'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Client
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="browser / companion version" />
        </label>
        <label>
          URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Logs (trimmed)
          <textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={4} />
        </label>
        <button className="gt-btn" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
