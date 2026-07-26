/**
 * Fetch single-player assist pack for a game (ENABLE_GAME_ASSISTS).
 * @param {string} gameUuid
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ enabled: boolean, pack: object | null }>}
 */
export async function fetchGameAssists(gameUuid, options = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/assists`, {
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (!response.ok) {
    throw new Error(`Assists request failed (${response.status})`)
  }
  return response.json()
}
