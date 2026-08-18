import { errorFromResponse } from './envelopeError'

export async function fetchMyPlaytime({ signal } = {}) {
  const response = await fetch('/api/playtime/me', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'playtime/me')
  }

  return response.json()
}
