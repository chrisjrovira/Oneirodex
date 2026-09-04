import { useEffect, useState } from 'react'
import { errorFromResponse } from '../api/envelopeError'
import { pickLoadingMotifId } from './LoadingMotif'

let cachedSettings = null
let inflight = null
let sessionMotif = null

/**
 * The shell's own loading-motif script may already have these.
 *
 * `od_loading_motifs.js` ships with the theme and runs before this bundle
 * mounts, and it fetches the same endpoint. Both cached correctly on their own
 * but in separate module scopes, so a member page requested /api/loading-icon
 * twice. The window is the only scope both can see. Wrapped because a
 * hardened context can throw on window access, in which case we simply fetch.
 */
function sharedSettings() {
  try {
    return window.__odLoadingIcon || null
  } catch {
    return null
  }
}

function sharedPending() {
  try {
    return window.__odLoadingIconPending || null
  } catch {
    return null
  }
}

export async function fetchLoadingIconSettings() {
  if (cachedSettings) {
    return cachedSettings
  }
  const shared = sharedSettings()
  if (shared) {
    cachedSettings = shared
    return cachedSettings
  }
  if (inflight) {
    return inflight
  }
  const pending = sharedPending()
  if (pending) {
    inflight = Promise.resolve(pending)
      .then((data) => {
        cachedSettings = data || cachedSettings
        return cachedSettings
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }
  inflight = fetch('/api/loading-icon', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw await errorFromResponse(res, 'loading-icon')
      }
      return res.json()
    })
    .then((data) => {
      cachedSettings = data || {}
      try {
        window.__odLoadingIcon = cachedSettings
      } catch {
        // no window cache available; the module cache still applies
      }
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
