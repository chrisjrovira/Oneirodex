export async function fetchCalendar({
  signal,
  daysAhead = 60,
  daysBehind = 14,
  limit = 40,
} = {}) {
  const params = new URLSearchParams({
    days_ahead: String(daysAhead),
    days_behind: String(daysBehind),
    limit: String(limit),
  })
  const response = await fetch(`/api/calendar?${params}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`calendar ${response.status}`)
  }

  return response.json()
}
