import { getJson } from './client'

export async function fetchBrowseGames(params: LooseProps, { signal }: LooseProps = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
  return getJson(`/browse_games?${qs}`, { signal, label: 'browse_games' })
}
