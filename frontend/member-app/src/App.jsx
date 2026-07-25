import { useEffect, useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { applyTileSizeCssVars, TileSizeControl } from './chrome/TileSizeControl'
import { TopNav } from './chrome/TopNav'
import { DiscoverApp } from './DiscoverApp'
import { FavoritesApp } from './FavoritesApp'
import { LibraryApp } from './LibraryApp'
import { DownloadsPage } from './pages/DownloadsPage'

function libraryInitialConfig(shellConfig) {
  return {
    perPage: Number(shellConfig.perPage) || 20,
    defaultSort: shellConfig.defaultSort || 'name',
    defaultSortOrder: shellConfig.defaultSortOrder || 'asc',
    isAdmin: Boolean(shellConfig.isAdmin),
    showPlayStatus: Boolean(shellConfig.showPlayStatus),
    libraryCount: Number(shellConfig.libraryCount) || 0,
    gamesCount: Number(shellConfig.gamesCount) || 0,
    enableDeleteOnDisk: Boolean(shellConfig.enableDeleteOnDisk),
    discordConfigured: Boolean(shellConfig.discordConfigured),
    discordManualTrigger: Boolean(shellConfig.discordManualTrigger),
    locale: shellConfig.locale || 'en',
    currentFilters: shellConfig.currentFilters || {},
  }
}

function PageHeader({ title, tileSize, onTileSizeChange, shellConfig }) {
  return (
    <div className="gt-page-header">
      <h1>{title}</h1>
      <TileSizeControl
        value={tileSize}
        onChange={onTileSizeChange}
        shellConfig={shellConfig}
      />
    </div>
  )
}

function Layout({ shellConfig, tileSize, onTileSizeChange }) {
  return (
    <>
      <TopNav
        shellConfig={shellConfig}
        tileSize={tileSize}
        onTileSizeChange={onTileSizeChange}
      />
      <Outlet />
    </>
  )
}

export function App({ shellConfig = {} }) {
  const sections = Array.isArray(shellConfig.sections) ? shellConfig.sections : []
  const [tileSize, setTileSize] = useState(shellConfig.tileSize || 'M')

  useEffect(() => {
    applyTileSizeCssVars(tileSize)
  }, [tileSize])

  return (
    <Routes>
      <Route
        element={
          <Layout
            shellConfig={shellConfig}
            tileSize={tileSize}
            onTileSizeChange={setTileSize}
          />
        }
      >
        <Route
          path="/discover"
          element={
            <>
              <PageHeader
                title="Discover"
                tileSize={tileSize}
                onTileSizeChange={setTileSize}
                shellConfig={shellConfig}
              />
              <DiscoverApp
                sections={sections}
                isAdmin={Boolean(shellConfig.isAdmin)}
                shellConfig={shellConfig}
              />
            </>
          }
        />
        <Route
          path="/library"
          element={
            <>
              <PageHeader
                title="Library"
                tileSize={tileSize}
                onTileSizeChange={setTileSize}
                shellConfig={shellConfig}
              />
              <LibraryApp
                initialConfig={libraryInitialConfig(shellConfig)}
                shellConfig={shellConfig}
              />
            </>
          }
        />
        <Route
          path="/favorites"
          element={
            <>
              <PageHeader
                title="Favorites"
                tileSize={tileSize}
                onTileSizeChange={setTileSize}
                shellConfig={shellConfig}
              />
              <FavoritesApp
                initialConfig={{
                  isAdmin: Boolean(shellConfig.isAdmin),
                  showPlayStatus: Boolean(shellConfig.showPlayStatus),
                }}
                shellConfig={shellConfig}
              />
            </>
          }
        />
        <Route
          path="/downloads"
          element={<DownloadsPage shellConfig={shellConfig} />}
        />
      </Route>
    </Routes>
  )
}