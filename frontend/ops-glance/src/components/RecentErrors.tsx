import type { OpsRecentError } from '../api/summary'

export interface RecentErrorsProps {
  errors?: OpsRecentError[] | null
}

export function RecentErrors({ errors }: RecentErrorsProps) {
  return (
    <section className="ops-panel">
      <h2>Recent errors</h2>
      {!errors ? (
        <p>Error data unavailable.</p>
      ) : errors.length === 0 ? (
        <p>No recent errors.</p>
      ) : (
        <ul>
          {errors.map((error) => (
            <li key={error.id}>
              <time dateTime={error.timestamp ?? undefined}>{error.timestamp}</time>: {error.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
