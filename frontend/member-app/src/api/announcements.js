export async function fetchAnnouncements({ signal } = {}) {
  const response = await fetch('/api/announcements', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`announcements ${response.status}`)
  }

  return response.json()
}
