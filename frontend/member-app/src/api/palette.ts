import { getJson } from './client'

/**
 * Empty-state titles for the command palette: recently played + favourited here.
 */
export async function fetchPaletteSuggest({ signal, limit = 8 }: LooseProps = {}) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  const data = await getJson(`/api/palette/suggest?${params}`, { signal, label: 'palette suggest' })
  return {
    recent: Array.isArray(data.recent) ? data.recent : [],
    popular: Array.isArray(data.popular) ? data.popular : [],
  }
}
