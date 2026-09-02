import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.scrollTo; @tanstack/react-virtual calls it.
if (typeof window !== 'undefined' && !window.scrollTo?.mock) {
  window.scrollTo = () => {}
}

// jsdom does not implement Element.scrollIntoView; cmdk uses it for selection.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

/**
 * jsdom does not implement window.matchMedia; the rail (GT-B2) uses it to tell
 * the mobile drawer from the desktop collapse. useRailState guards for its
 * absence, but without a stub every test would silently take the desktop branch
 * — including any test that means to assert drawer behaviour. Defaults to
 * desktop (non-matching) and is overridable per test.
 */
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

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

/**
 * Node 26+ jsdom may omit Storage unless --localstorage-file is set.
 * Polyfill so LHN collapse preference tests (and cookie helpers) stay deterministic.
 */
function installMemoryLocalStorage() {
  const store = new Map()
  const memory = {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
    removeItem(key) {
      store.delete(String(key))
    },
    clear() {
      store.clear()
    },
    key(index) {
      return [...store.keys()][index] ?? null
    },
    get length() {
      return store.size
    },
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    get: () => memory,
  })
}

if (typeof window !== 'undefined') {
  let needsPolyfill = false
  try {
    const probe = '__od_ls_probe__'
    window.localStorage?.setItem(probe, '1')
    if (window.localStorage?.getItem(probe) !== '1') {
      needsPolyfill = true
    }
    window.localStorage?.removeItem(probe)
  } catch {
    needsPolyfill = true
  }
  if (needsPolyfill || !window.localStorage) {
    installMemoryLocalStorage()
  }
}
