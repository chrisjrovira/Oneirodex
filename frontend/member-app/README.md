# member-app

React member SPA for **Oneirodex** (Discover, Library, Favorites, Downloads).

## Build

```bash
npm ci
npm run build
```

Output is written to `oneirodex/static/dist/member-app/` (see `vite.config.js`).

## Test

```bash
npm test
```

## Docker

The root `Dockerfile` builds this bundle in the `frontend-build` stage and copies the result into the Python image at `/app/oneirodex/static/dist/member-app`.