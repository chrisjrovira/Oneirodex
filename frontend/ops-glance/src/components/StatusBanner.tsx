import type { OpsIssues } from '../api/summary'

const labels: Record<string, string> = {
  good: 'All systems healthy',
  warn: 'Attention needed',
  bad: 'Action required',
}

export interface StatusBannerProps {
  issues?: OpsIssues | null
  asOf?: string | null
}

export function StatusBanner({ issues, asOf }: StatusBannerProps) {
  const severity = issues?.overall ?? 'good'
  return (
    <section className={`ops-status ops-status--${severity}`} aria-label="System status">
      <strong>{labels[severity] ?? labels.good}</strong>
      {asOf && <span>Updated {new Date(asOf).toLocaleString()}</span>}
    </section>
  )
}
