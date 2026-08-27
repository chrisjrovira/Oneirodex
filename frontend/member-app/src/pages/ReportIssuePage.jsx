import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'
import { PageStatus } from '../components/PageStatus'
import './ReportIssuePage.css'

const AREAS = [
  'auth', 'library', 'download', 'webretro', 'companion', 'acquire',
  'social', 'themes', 'admin', 'oidc', 'security', 'other',
]

/**
 * Seed the form from the query string, for reports opened from somewhere.
 *
 * The tile menu's "Report an issue" arrives with the game's name and its
 * details URL already known. Making the member retype them is how a report ends
 * up saying "the artwork is wrong" with no way to tell which of nine hundred
 * titles they meant.
 *
 * Only fields the form already owns, and `area` only when it is one of the
 * allowed values — a link is untrusted input like any other, and a bad `area`
 * would put the select into a state its own options cannot represent.
 */
export function prefillFromSearch(params) {
  const area = params.get('area')
  return {
    title: params.get('title') || '',
    url: params.get('url') || '',
    area: AREAS.includes(area) ? area : 'other',
  }
}

export function ReportIssuePage() {
  const [searchParams] = useSearchParams()
  const [seeded] = useState(() => prefillFromSearch(searchParams))
  const [title, setTitle] = useState(seeded.title)
  const [body, setBody] = useState('')
  const [area, setArea] = useState(seeded.area)
  const [kind, setKind] = useState('issue')
  const [severity, setSeverity] = useState('P2')
  const [deploy, setDeploy] = useState('Unraid')
  const [client, setClient] = useState('')
  const [url, setUrl] = useState(seeded.url)
  const [logs, setLogs] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title,
          body,
          kind,
          area,
          severity,
          deploy_hint: deploy,
          client_hint: client,
          url_hint: url,
          logs,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw errorFromBody(data, response.status, 'Submit failed')
      setResult(data.ticket)
      setTitle('')
      setBody('')
      setLogs('')
      setDetailsOpen(false)
      setLogsOpen(false)
    } catch (err) {
      setError(err.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gt-more-page gt-report">
      <div className="gt-page-header">
        <h1>Report</h1>
      </div>
      <p className="gt-more-page__lede">
        Files a ticket for maintainers. Syncs to GitHub when configured; admins see it in-app.
      </p>

      {error ? <PageStatus error={error} /> : null}
      {result ? (
        <div className="gt-report__result" role="status">
          <strong>Ticket #{result.id} saved</strong>
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
        </div>
      ) : null}

      <form className="gt-report__form" onSubmit={submit}>
        <section className="gt-report__primary" aria-labelledby="report-primary-heading">
          <h2 className="gt-report__section-title" id="report-primary-heading">
            What happened
          </h2>

          {/* Asked first, because it changes what the rest of the form means.
              The page was headed "Report issue" and collected feature requests
              into the same pile, so triage had to read every title to sort
              them — and a request filed as a bug reads as a broken product. */}
          <fieldset className="gt-report__kind">
            <legend className="gt-report__kind-legend">What are you filing?</legend>
            <div className="gt-report__kind-options">
              {[
                { id: 'issue', label: 'Something is broken', hint: 'It does not work as it should' },
                { id: 'enhancement', label: 'An idea', hint: 'Something new, or better' },
              ].map((option) => (
                <label
                  key={option.id}
                  className="gt-report__kind-option"
                  data-selected={kind === option.id ? 'true' : undefined}
                >
                  <input
                    type="radio"
                    name="report-kind"
                    value={option.id}
                    checked={kind === option.id}
                    onChange={() => setKind(option.id)}
                  />
                  <span className="gt-report__kind-label">{option.label}</span>
                  <span className="gt-report__kind-hint">{option.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="gt-report__field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Short summary"
            />
          </label>
          <label className="gt-report__field">
            <span>Symptom</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              placeholder="What you expected vs what you saw"
            />
          </label>
          <div className="gt-report__row">
            <label className="gt-report__field">
              <span>Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="gt-report__field">
              <span>Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {['P0', 'P1', 'P2', 'P3'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <details
          className="gt-report__fold"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        >
          <summary>Context (deploy, client, URL)</summary>
          {detailsOpen ? (
            <div className="gt-report__fold-body">
              <div className="gt-report__row">
                <label className="gt-report__field">
                  <span>Deploy</span>
                  <select value={deploy} onChange={(e) => setDeploy(e.target.value)}>
                    {['Unraid', 'Compose', 'native', 'other'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="gt-report__field">
                  <span>Client</span>
                  <input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="browser / companion version"
                  />
                </label>
              </div>
              <label className="gt-report__field">
                <span>URL</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Page where it broke" />
              </label>
            </div>
          ) : null}
        </details>

        <details
          className="gt-report__fold"
          open={logsOpen}
          onToggle={(e) => setLogsOpen(e.currentTarget.open)}
        >
          <summary>Logs &amp; extras (optional)</summary>
          {logsOpen ? (
            <div className="gt-report__fold-body">
              <label className="gt-report__field">
                <span>Logs (trimmed)</span>
                <textarea
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  rows={6}
                  placeholder="Paste only the relevant lines"
                />
              </label>
            </div>
          ) : null}
        </details>

        <div className="gt-report__actions">
          <button className="gt-btn" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Submit ticket'}
          </button>
          <Link className="gt-report__help-link" to="/help">
            Help FAQ
          </Link>
        </div>
      </form>
    </div>
  )
}
