import { errorFromResponse } from './envelopeError'

export async function fetchAnnouncements({ signal } = {}) {
  const response = await fetch('/api/announcements', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'announcements')
  }

  return response.json()
}
