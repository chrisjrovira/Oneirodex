/**
 * Format an ISO date string (or Date-like input) for the user's locale.
 * @param {string|number|Date|null|undefined} value
 * @param {{ fallback?: string, includeTime?: boolean }} [options]
 * @returns {string}
 */
export function formatLocaleDate(value, options = {}) {
  const fallback = options.fallback ?? '—'
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  let date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'number') {
    // Treat small integers as unix seconds (common for release epochs).
    date = new Date(value < 1e12 ? value * 1000 : value)
  } else {
    const text = String(value).trim()
    if (/^\d{10}$/.test(text)) {
      date = new Date(Number(text) * 1000)
    } else if (/^\d{13}$/.test(text)) {
      date = new Date(Number(text))
    } else {
      // Prefer date-only ISO so local TZ does not shift the calendar day.
      const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/)
      date = dateOnly ? new Date(`${dateOnly[1]}T12:00:00`) : new Date(text)
    }
  }

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  if (options.includeTime) {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
