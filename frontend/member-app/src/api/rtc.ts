/**
 * LiveKit RTC: status probe and short-lived room tokens.
 *
 * VoiceLobby and the social companion minted these with inlined `fetch`.
 */
import { getJson, postJson } from './client'

export async function fetchRtcStatus() {
  try {
    return (await getJson('/api/rtc/status', { label: 'rtc/status' })) ?? { enabled: false }
  } catch {
    return { enabled: false }
  }
}

export async function mintRtcToken(payload: any, { label = 'Token failed' }: LooseProps = {}) {
  return (await postJson('/api/rtc/token', payload, { label })) ?? {}
}
