import { postJson, send } from './client'

export function toggleFavorite(gameUuid: any) {
  return send(`/api/toggle_favorite/${gameUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    label: 'Request failed:',
  })
}

export function setGameStatus(gameUuid: any, status: any) {
  return postJson(`/api/set_game_status/${gameUuid}`, { status }, { label: 'Request failed:' })
}
