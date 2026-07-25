# library-grid

React library browser bundle for **GameTheca**.

## Build

```bash
npm ci
npm run build
```

Output is written to `gametheca/static/dist/library-grid/` (see `vite.config.js`).

## Test

```bash
npm test
```

## Docker

The root `Dockerfile` builds this bundle in a `library-grid-build` stage and copies the result into the Python image at `/app/gametheca/static/dist/library-grid`.
