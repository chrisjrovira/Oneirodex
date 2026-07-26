/** Platform family skins for Style B+C system-aware chrome. */

const NINTENDO = new Set([
  'NES', 'SNES', 'NGC', 'N64', 'GB', 'GBA', 'GBC', 'NDS', 'VB',
])
const SONY = new Set(['PSX', 'PS2', 'PS3', 'PS4', 'PS5'])
const XBOX = new Set(['XBOX', 'X360', 'XONE', 'XSX'])
const SEGA = new Set([
  'SEGA_MD', 'SEGA_MS', 'SEGA_CD', 'SEGA_32X', 'SEGA_GG', 'SEGA_SATURN',
])
const ATARI = new Set([
  'ATARI_7800', 'ATARI_5200', 'ATARI_2600', 'LYNX', 'JAGUAR',
  'PCE', 'PCFX', 'NGP', 'WS', 'COLECO', 'THREEDO', 'VECTREX',
  'VICE_X64SC', 'VICE_X128', 'VICE_XVIC', 'VICE_XPLUS4', 'VICE_XPET',
  'NEOGEO_CD', 'INTV', 'CHAF', 'O2EM',
])
const PC = new Set(['PCWIN', 'PCDOS', 'MAC', 'OTHER'])

const FAMILY_BY_PLATFORM = {
  nintendo: NINTENDO,
  sony: SONY,
  xbox: XBOX,
  sega: SEGA,
  atari: ATARI,
  pc: PC,
}

const FAMILY_META = {
  nintendo: {
    family: 'nintendo',
    accent: '#e60012',
    motion: 'pixel',
    label: 'Nintendo',
  },
  sony: {
    family: 'sony',
    accent: '#0070d1',
    motion: 'sheen',
    label: 'Sony',
  },
  xbox: {
    family: 'xbox',
    accent: '#2fd67b',
    motion: 'pulse',
    label: 'Xbox',
  },
  sega: {
    family: 'sega',
    accent: '#1a66ff',
    motion: 'bounce',
    label: 'Sega',
  },
  atari: {
    family: 'atari',
    accent: '#f5a623',
    motion: 'crt',
    label: 'Retro',
  },
  pc: {
    family: 'pc',
    accent: '',
    motion: 'none',
    label: 'PC',
  },
}

export function platformFamily(platformId) {
  if (!platformId) {
    return null
  }
  const id = String(platformId).toUpperCase()
  for (const [family, members] of Object.entries(FAMILY_BY_PLATFORM)) {
    if (members.has(id)) {
      return family
    }
  }
  return 'pc'
}

export function skinForPlatform(platformId) {
  const family = platformFamily(platformId)
  if (!family) {
    return null
  }
  return { ...FAMILY_META[family], platform: String(platformId).toUpperCase() }
}

export function familyForPlatform(platformId) {
  return platformFamily(platformId) || 'pc'
}

/**
 * Apply or clear platform skin on documentElement.
 * @param {string|null|undefined} platformId LibraryPlatform enum name
 */
export function applyPlatformSkin(platformId) {
  const root = document.documentElement
  const skin = skinForPlatform(platformId)
  if (!skin || !platformId) {
    root.removeAttribute('data-platform')
    root.removeAttribute('data-platform-family')
    root.removeAttribute('data-platform-motion')
    root.style.removeProperty('--gt-platform-accent')
    root.style.removeProperty('--gt-platform-motion')
    return null
  }

  root.setAttribute('data-platform', skin.platform)
  root.setAttribute('data-platform-family', skin.family)
  root.setAttribute('data-platform-motion', skin.motion)
  if (skin.accent) {
    root.style.setProperty('--gt-platform-accent', skin.accent)
  } else {
    root.style.removeProperty('--gt-platform-accent')
  }
  root.style.setProperty('--gt-platform-motion', skin.motion)
  return skin
}

export function clearPlatformSkin() {
  return applyPlatformSkin(null)
}

/** Shared library_platform across items, or null if mixed/empty. */
export function sharedPlatform(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }
  const first = items[0]?.library_platform
  if (!first) {
    return null
  }
  return items.every((item) => item.library_platform === first) ? first : null
}
