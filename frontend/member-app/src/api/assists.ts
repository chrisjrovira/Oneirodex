/**
 * Fetch single-player assist pack for a game (ENABLE_GAME_ASSISTS).
 * @param {string} gameUuid
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ enabled: boolean, pack: object | null }>}
 */
import { getJson } from './client'

export async function fetchGameAssists(gameUuid: any, options: LooseProps = {}) {
  return getJson(`/api/games/${encodeURIComponent(gameUuid)}/assists`, {
    signal: options.signal,
    label: 'Assists request failed',
  })
}
