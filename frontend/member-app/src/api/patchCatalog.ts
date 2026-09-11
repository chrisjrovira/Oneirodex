import { getJson, postJson } from './client'

export async function searchPatchCatalog({ gameUuid, q, signal }: LooseProps = {}) {
  const params = new URLSearchParams()
  if (gameUuid) {
    params.set('game_uuid', gameUuid)
  }
  if (q) {
    params.set('q', q)
  }
  return (
    (await getJson(`/api/patch-catalog/search?${params}`, {
      signal,
      label: 'patch-catalog search',
    })) ?? {}
  )
}

export async function attachPatchCatalogGuide(body: any) {
  return (
    (await postJson('/api/patch-catalog/attach', body, { label: 'patch-catalog attach' })) ?? {}
  )
}
