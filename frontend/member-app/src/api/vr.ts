import { getJson } from './client'

export async function fetchVrCatalog({ signal, page = 1, perPage = 48 }: LooseProps = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  return getJson(`/api/vr/catalog?${params}`, { signal, label: 'vr/catalog' })
}

export async function fetchVrGame(gameUuid: any, { signal }: LooseProps = {}) {
  return getJson(`/api/vr/games/${encodeURIComponent(gameUuid)}`, {
    signal,
    label: 'vr/games',
  })
}
