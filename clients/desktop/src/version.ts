/**
 * Build-time client version, injected by vite.config.ts / vitest.config.ts.
 *
 * The `typeof` guard keeps this safe under any runner that does not define the
 * global (a bare `tsc` run, a consumer embedding these modules) — it degrades to
 * a marker rather than throwing a ReferenceError inside the heartbeat.
 */
declare const __APP_VERSION__: string | undefined

export const CLIENT_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0-dev'
