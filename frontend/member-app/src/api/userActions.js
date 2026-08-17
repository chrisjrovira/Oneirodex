import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'Request failed:')
  }

  return response.json()
}

export function toggleFavorite(gameUuid) {
  return postJson(`/api/toggle_favorite/${gameUuid}`)
}

export function setGameStatus(gameUuid, status) {
  return postJson(`/api/set_game_status/${gameUuid}`, { status })
}
