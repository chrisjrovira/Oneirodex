// Vite turns a `.css` import into a side-effecting style injection; TypeScript
// only needs to know the import is legal.
declare module '*.css'

// Store-brand PNGs (ExternalStoreLinks) — Vite emits a URL string.
declare module '*.png' {
  const src: string
  export default src
}
