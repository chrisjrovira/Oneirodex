import { getJson } from './client'

export async function fetchGamingNews({ signal }: LooseProps = {}) {
  return getJson('/api/news/gaming?limit=12', { signal, label: 'gaming news' })
}
