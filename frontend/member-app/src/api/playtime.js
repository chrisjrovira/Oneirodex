export async function fetchMyPlaytime({ signal } = {}) {
  const response = await fetch('/api/playtime/me', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`playtime/me ${response.status}`)
  }

  return response.json()
}
