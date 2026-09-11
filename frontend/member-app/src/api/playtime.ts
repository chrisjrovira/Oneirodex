import { getJson } from './client'

export async function fetchMyPlaytime({ signal }: LooseProps = {}) {
  return getJson('/api/playtime/me', { signal, label: 'playtime/me' })
}
