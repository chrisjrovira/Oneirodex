/**
 * Remote play / Moonlight BYO host status (ENABLE_REMOTE_PLAY).
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
import { errorFromResponse } from './envelopeError'

export async function fetchRemotePlayStatus(options = {}) {
  const response = await fetch('/api/remote-play/status', {
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Remote play status failed')
  }
  return response.json()
}
