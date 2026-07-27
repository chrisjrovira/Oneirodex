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
  },
})
