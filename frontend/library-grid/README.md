# library-grid

React library browser bundle for **GameTheca**.

## Build

```bash
npm ci
npm run build
```

Output is written to `sharewarez/static/dist/library-grid/` (Python package path remains `sharewarez/` for now; see `vite.config.js`).

## Test

```bash
npm test
```

## Docker

The root `Dockerfile` builds this bundle in a `library-grid-build` stage and copies the result into the Python image at `/app/sharewarez/static/dist/library-grid`.
