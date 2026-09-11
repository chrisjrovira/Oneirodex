import { getJson } from './client'

export async function fetchCalendar({
  signal,
  daysAhead = 60,
  daysBehind = 14,
  limit = 40,
}: LooseProps = {}) {
  const params = new URLSearchParams({
    days_ahead: String(daysAhead),
    days_behind: String(daysBehind),
    limit: String(limit),
  })
  return getJson(`/api/calendar?${params}`, { signal, label: 'calendar' })
}
