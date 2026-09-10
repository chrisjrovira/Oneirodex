// Vite resolves these to real asset/style URLs at build time; TypeScript only
// needs to know the import is legal. `@oneirodex/ui` ships source, so the
// consuming SPA's bundler does the actual work.
declare module '*.css'
