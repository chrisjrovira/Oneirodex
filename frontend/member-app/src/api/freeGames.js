export async function fetchFreeGames({ signal, store } = {}) {
  const params = new URLSearchParams({ limit: '40' })
  if (store) {
    params.set('store', store)
  }
  const response = await fetch(`/api/news/free-games?${params}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`free games ${response.status}`)
  }

  return response.json()
}

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export async function claimFreeGameAssist(offerId) {
  const response = await fetch(`/api/news/free-games/${offerId}/claim-assist`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: '{}',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `claim assist ${response.status}`)
  }
  return data
}
