export async function fetchUpdatesInbox({ signal, limit = 100 } = {}) {
  const response = await fetch(`/api/updates/inbox?limit=${limit}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`updates/inbox ${response.status}`)
  }

  return response.json()
}
