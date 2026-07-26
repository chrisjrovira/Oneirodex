export async function fetchGamingNews({ signal } = {}) {
  const response = await fetch('/api/news/gaming?limit=12', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`gaming news ${response.status}`)
  }

  return response.json()
}
