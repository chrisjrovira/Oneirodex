import { useEffect, useState } from 'react'
import { pickLoadingMotifId } from './LoadingMotif'

let cachedSettings = null
let inflight = null
let sessionMotif = null

export async function fetchLoadingIconSettings() {
  if (cachedSettings) {
    return cachedSettings
  }
  if (inflight) {
    return inflight
  }
  inflight = fetch('/api/loading-icon', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`loading-icon ${res.status}`)
      }
      return res.json()
    })
    .then((data) => {
      cachedSettings = data || {}
      return cachedSettings
    })
    .catch(() => {
      cachedSettings = {
        loading_icon_mode: 'rotate',
        loading_icon_id: null,
        resolved_id: null,
        catalogue: [],
      }
      return cachedSettings
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function clearLoadingIconCache() {
  cachedSettings = null
  inflight = null
  sessionMotif = null
}

/**
 * Resolves the motif id for this session (lock or random rotate).
 */
export function useLoadingMotifId(forceId = null) {
  const [motifId, setMotifId] = useState(() => forceId || sessionMotif || 'ring')

  useEffect(() => {
    if (forceId) {
      setMotifId(forceId)
      return undefined
    }
    let cancelled = false
    fetchLoadingIconSettings().then((settings) => {
      if (cancelled) return
      if (!sessionMotif) {
        sessionMotif = pickLoadingMotifId(settings, null)
      }
      setMotifId(pickLoadingMotifId(settings, sessionMotif))
    })
    return () => {
      cancelled = true
    }
  }, [forceId])

  return motifId
}
