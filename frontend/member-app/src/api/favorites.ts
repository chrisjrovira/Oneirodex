import { getJson } from './client'

export async function fetchFavoriteGames(params: LooseProps = {}, { signal }: LooseProps = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
  const suffix = qs.toString() ? `?${qs}` : ''
  return getJson(`/api/favorites${suffix}`, { signal, label: 'favorites' })
}
