import { getJson } from './client'

export async function fetchAnnouncements({ signal }: LooseProps = {}) {
  return getJson('/api/announcements', { signal, label: 'announcements' })
}
