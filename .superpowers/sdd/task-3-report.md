# Task 3 Report: Rename library-grid to member-app + router shell

**Status:** DONE

**Changes:**
- Renamed frontend/library-grid to frontend/member-app (git mv)
- Package name member-app; Vite base/outDir/entry member-app.js
- Added react-router-dom; App.jsx routes /discover, /library, /favorites, /downloads
- Stub TopNav + DownloadsPage; main.jsx mounts #member-app-root + keeps #game-details-react-root
- Dockerfile / entrypoint.sh / template script tags / README updated for member-app paths

**Tests:**
`
cd frontend/member-app && npm test -- --run src/App.test.jsx

 Test Files  1 passed (1)
      Tests  1 passed (1)
`

**Commit:** refactor: rename library-grid to member-app and add router shell
