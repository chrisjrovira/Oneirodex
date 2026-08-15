import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/admin-app/',
  build: {
    outDir: path.resolve(__dirname, '../../gametheca/static/dist/admin-app'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'admin-app.js',
        assetFileNames: 'admin-app.[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    // Matches member-app, and for the same reason: on a network-mounted
    // checkout module resolve+transform is charged to the test clock, so a
    // pure-logic test can cross the 5s default with no bug behind it —
    // DupeGlance's normalizeTransforms case failed at 10.7s that way while
    // passing alone. Raised now rather than later because this suite just
    // became a CI gate, and a flaky gate is worse than no gate.
    testTimeout: 30000,
  },
})
