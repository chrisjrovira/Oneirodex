import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/ops-glance/',
  build: {
    outDir: path.resolve(__dirname, '../../oneirodex/static/dist/ops-glance'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'ops-glance.js',
        assetFileNames: 'ops-glance.[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
  },
})
