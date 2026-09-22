/** Platform family skins for Style B+C system-aware chrome. */
import { FAMILY_META, platformFamily } from '@oneirodex/ui'

export { FAMILY_BY_PLATFORM, FAMILY_META, platformFamily } from '@oneirodex/ui'
export type { FamilyMeta, PlatformFamily } from '@oneirodex/ui'

export function skinForPlatform(platformId: any) {
  const family = platformFamily(platformId)
  if (!family) {
    return null
  }
  return { ...FAMILY_META[family], platform: String(platformId).toUpperCase() }
}

export function familyForPlatform(platformId: any) {
  return platformFamily(platformId) || 'pc'
}

/**
 * Apply or clear platform skin on documentElement.
 * @param {string|null|undefined} platformId LibraryPlatform enum name
 */
export function applyPlatformSkin(platformId: any) {
  const root = document.documentElement
  const skin = skinForPlatform(platformId)
  if (!skin || !platformId) {
    root.removeAttribute('data-platform')
    root.removeAttribute('data-platform-family')
    root.removeAttribute('data-platform-motion')
    root.style.removeProperty('--od-platform-accent')
    root.style.removeProperty('--od-platform-motion')
    return null
  }

  root.setAttribute('data-platform', skin.platform)
  root.setAttribute('data-platform-family', skin.family)
  root.setAttribute('data-platform-motion', skin.motion)
  if (skin.accent) {
    root.style.setProperty('--od-platform-accent', skin.accent)
  } else {
    root.style.removeProperty('--od-platform-accent')
  }
  root.style.setProperty('--od-platform-motion', skin.motion)
  return skin
}

export function clearPlatformSkin() {
  return applyPlatformSkin(null)
}

/** Shared library_platform across items, or null if mixed/empty. */
export function sharedPlatform(items: any) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }
  const first = items[0]?.library_platform
  if (!first) {
    return null
  }
  return items.every((item) => item.library_platform === first) ? first : null
}
