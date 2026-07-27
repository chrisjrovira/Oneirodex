/**
 * Remote play / Moonlight BYO host status (ENABLE_REMOTE_PLAY).
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export async function fetchRemotePlayStatus(options = {}) {
  const response = await fetch('/api/remote-play/status', {
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (!response.ok) {
    throw new Error(`Remote play status failed (${response.status})`)
  }
  return response.json()
}
