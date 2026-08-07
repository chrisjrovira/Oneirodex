import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/member-app/',
  build: {
    outDir: path.resolve(__dirname, '../../gametheca/static/dist/member-app'),
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'member-app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep a stable entry stylesheet for any static link; chunk CSS stay hashed
          // so lazy routes do not collide on member-app.css / member-app2.css.
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            const names = assetInfo.names || []
            const isEntryCss =
              names.some((n) => n === 'index.css' || n === 'style.css') ||
              assetInfo.name === 'index.css' ||
              assetInfo.name === 'style.css'
            if (isEntryCss) {
              return 'member-app.css'
            }
            return 'chunks/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
              return 'react-vendor'
            }
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    // userEvent interactions take ~9s on a network-mounted checkout; the 5s
    // default fails them spuriously while they pass fine given room to run.
    //
    // 30s was still not enough for the *whole* suite. A full run reports around
    // 14,000s of cumulative jsdom environment setup against 1,150s of wall
    // time, so a dozen workers are contending for one network mount and the
    // slowest userEvent tests (SpaceRail voice selection, ReportIssuePage logs
    // fold) crossed 30s — while passing in seconds on their own. That is
    // contention, not a hang, and a flake that only appears in the full run is
    // worse than a slow one: it teaches you to stop trusting the full run.
    testTimeout: 90000,
  },
})
