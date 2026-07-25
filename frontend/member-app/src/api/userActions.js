function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }

  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }

  return document.getElementById('csrf_token')?.textContent || null
}

function csrfHeaders(additionalHeaders = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(additionalHeaders)
  }

  return {
    'X-CSRFToken': getCsrfToken(),
    ...additionalHeaders,
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.statusText || response.status}`)
  }

  return response.json()
}

export function toggleFavorite(gameUuid) {
  return postJson(`/api/toggle_favorite/${gameUuid}`)
}

export function setGameStatus(gameUuid, status) {
  return postJson(`/api/set_game_status/${gameUuid}`, { status })
}
