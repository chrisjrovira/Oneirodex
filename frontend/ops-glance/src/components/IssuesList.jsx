export function IssuesList({ issues }) {
  const items = issues?.items ?? []
  return (
    <section className="ops-panel">
      <h2>Issues</h2>
      {items.length === 0 ? <p>No active issues.</p> : (
        <ul>
          {items.map((issue) => (
            <li key={issue.id} className={`ops-issue--${issue.severity}`}>
              {issue.href ? <a href={issue.href}>{issue.message}</a> : issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
