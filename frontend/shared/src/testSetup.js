import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.matchMedia; useRailState (GT-B2) and the
// PageStatus loading branch both read it. Default to the non-matching (desktop,
// no reduced-motion) branch; override per test where needed.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// Node 26+ jsdom may omit Storage; useRailState persists the collapse
// preference to localStorage. Polyfill so those tests stay deterministic.
if (typeof window !== 'undefined') {
  let needsPolyfill = false
  try {
    const probe = '__od_ls_probe__'
    window.localStorage?.setItem(probe, '1')
    if (window.localStorage?.getItem(probe) !== '1') needsPolyfill = true
    window.localStorage?.removeItem(probe)
  } catch {
    needsPolyfill = true
  }
  if (needsPolyfill || !window.localStorage) {
    const store = new Map()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      get: () => ({
        getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
        setItem: (k, v) => store.set(String(k), String(v)),
        removeItem: (k) => store.delete(String(k)),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() {
          return store.size
        },
      }),
    })
  }
}
