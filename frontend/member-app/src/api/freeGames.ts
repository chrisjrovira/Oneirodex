import { getJson, postJson } from './client'

export async function fetchFreeGames({ signal, store }: LooseProps = {}) {
  const params = new URLSearchParams({ limit: '40' })
  if (store) {
    params.set('store', store)
  }
  return getJson(`/api/news/free-games?${params}`, { signal, label: 'free games' })
}

export async function claimFreeGameAssist(offerId: any) {
  return (
    (await postJson(
      `/api/news/free-games/${offerId}/claim-assist`,
      {},
      { label: 'claim assist' },
    )) ?? {}
  )
}
