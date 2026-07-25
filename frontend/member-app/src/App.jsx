import { Outlet, Route, Routes } from 'react-router-dom'
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

function Layout({ shellConfig }) {
  return (
    <>
      <TopNav shellConfig={shellConfig} />
      <Outlet />
    </>
  )
}

export function App({ shellConfig = {} }) {
  const sections = Array.isArray(shellConfig.sections) ? shellConfig.sections : []

  return (
    <Routes>
      <Route element={<Layout shellConfig={shellConfig} />}>
        <Route
          path="/discover"
          element={
            <DiscoverApp sections={sections} isAdmin={Boolean(shellConfig.isAdmin)} />
          }
        />
        <Route
          path="/library"
          element={<LibraryApp initialConfig={libraryInitialConfig(shellConfig)} />}
        />
        <Route
          path="/favorites"
          element={
            <FavoritesApp
              initialConfig={{
                isAdmin: Boolean(shellConfig.isAdmin),
                showPlayStatus: Boolean(shellConfig.showPlayStatus),
              }}
            />
          }
        />
        <Route path="/downloads" element={<DownloadsPage />} />
      </Route>
    </Routes>
  )
}