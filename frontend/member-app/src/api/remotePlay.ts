/**
 * Remote play / Moonlight BYO host status (ENABLE_REMOTE_PLAY).
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
import { getJson } from './client'

export async function fetchRemotePlayStatus(options: LooseProps = {}) {
  return getJson('/api/remote-play/status', {
    signal: options.signal,
    label: 'Remote play status failed',
  })
}
