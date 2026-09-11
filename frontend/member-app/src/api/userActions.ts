import { csrfHeaders, errorFromResponse } from '@oneirodex/ui'
async function postJson(url: any, body: any = undefined) {
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

export function toggleFavorite(gameUuid: any) {
  return postJson(`/api/toggle_favorite/${gameUuid}`)
}

export function setGameStatus(gameUuid: any, status: any) {
  return postJson(`/api/set_game_status/${gameUuid}`, { status })
}
