const STORAGE_KEY = 'oneirodex.dismissedBadges.v1'

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / private mode
  }
}

export function listDismissedKinds(gameUuid) {
  if (!gameUuid) {
    return []
  }
  const store = readStore()
  const list = store[gameUuid]
  return Array.isArray(list) ? list : []
}

export function dismissBadge(gameUuid, kind) {
  // VR / MISSING join the top-left transitional stack — never dismissable.
  if (!gameUuid || !kind || kind === 'VR' || kind === 'MISSING') {
    return
  }
  const store = readStore()
  const current = new Set(Array.isArray(store[gameUuid]) ? store[gameUuid] : [])
  current.add(kind)
  store[gameUuid] = [...current]
  writeStore(store)
}

export function clearDismissedBadges(gameUuid) {
  if (!gameUuid) {
    return
  }
  const store = readStore()
  delete store[gameUuid]
  writeStore(store)
}

export function filterDismissedBadges(gameUuid, badges) {
  const dismissed = new Set(listDismissedKinds(gameUuid))
  if (dismissed.size === 0) {
    return badges
  }
  return badges.filter(
    (badge) => badge.kind === 'VR' || badge.kind === 'MISSING' || !dismissed.has(badge.kind),
  )
}
