const labels = {
  good: 'All systems healthy',
  warn: 'Attention needed',
  bad: 'Action required',
}

export function StatusBanner({ issues, asOf }) {
  const severity = issues?.overall ?? 'good'
  return (
    <section className={`ops-status ops-status--${severity}`} aria-label="System status">
      <strong>{labels[severity] ?? labels.good}</strong>
      {asOf && <span>Updated {new Date(asOf).toLocaleString()}</span>}
    </section>
  )
}
