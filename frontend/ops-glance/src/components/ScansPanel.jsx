export function ScansPanel({ scans }) {
  const jobs = scans?.jobs ?? []
  return (
    <section className="ops-panel">
      <h2>Scans</h2>
      {!scans ? <p>Scan data unavailable.</p> : (
        <>
          <p>{scans.active_count ?? 0} active</p>
          {jobs.length === 0 ? <p>No active scan jobs.</p> : (
            <ul>
              {jobs.map((job) => (
                <li key={job.id}>
                  {job.library ?? 'Unknown library'}: {job.status ?? 'unknown'} ({job.progress ?? 0}%)
                  {job.errors ? ` · ${job.errors} errors` : ''}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
