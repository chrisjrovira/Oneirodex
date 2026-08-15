import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement window.matchMedia; the rail (GT-B2) uses it to tell
 * the mobile drawer from the desktop collapse. Defaults to desktop.
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
