import '@testing-library/jest-dom/vitest'

// jsdom does not implement window.scrollTo; @tanstack/react-virtual calls it.
if (typeof window !== 'undefined' && !window.scrollTo?.mock) {
  window.scrollTo = () => {}
}

// jsdom does not implement Element.scrollIntoView; cmdk uses it for selection.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
