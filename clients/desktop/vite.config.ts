import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

/**
 * Real package version, injected as `__APP_VERSION__`.
 *
 * The heartbeat reports `client_version` to the Ops device list, and it used to
 * report a hardcoded "0.1.0" — so every 1.0.0-beta companion in the field
 * looked like a 0.1.0 one. Read it from package.json so a version bump cannot
 * miss this surface. Mirrored in vitest.config.ts so tests see the same value.
 */
const version = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
).version as string

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
  },
})
