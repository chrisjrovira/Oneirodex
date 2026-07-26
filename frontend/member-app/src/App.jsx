import { useEffect, useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { applyTileSizeCssVars } from './chrome/TileSizeControl'
import { TopNav } from './chrome/TopNav'
import { DiscoverApp } from './DiscoverApp'
import { FavoritesApp } from './FavoritesApp'
import { LibraryApp } from './LibraryApp'
import { ActivityPage } from './pages/ActivityPage'
import { ChatPage } from './pages/ChatPage'
import { MemberProfilePage } from './pages/MemberProfilePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { AcquirePage } from './pages/AcquirePage'
import { BigPicturePage } from './pages/BigPicturePage'
import { CalendarPage } from './pages/CalendarPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { DownloadsPage } from './pages/DownloadsPage'
import { HelpPage } from './pages/HelpPage'
import { NewsPage } from './pages/NewsPage'
import { OwnershipPage } from './pages/OwnershipPage'
import { PlaytimePage } from './pages/PlaytimePage'
import { TrailersPage } from './pages/TrailersPage'
import { UpdatesPage } from './pages/UpdatesPage'
import { VrPage } from './pages/VrPage'
import { WishlistPage } from './pages/WishlistPage'
import { SystemsPage } from './pages/SystemsPage'
import { GameDetailsPage } from './pages/GameDetailsPage'
import './pages/MorePage.css'
import './chrome/platformSkins.css'
import './chrome/glass.css'

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

function PageHeader({ title }) {
  return (
    <div className="gt-page-header">
      <h1>{title}</h1>
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
      <Route path="/big-picture" element={<BigPicturePage shellConfig={shellConfig} />} />
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
              <PageHeader title="Discover" />
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
              <PageHeader title="Library" />
              <LibraryApp
                initialConfig={libraryInitialConfig(shellConfig)}
                shellConfig={shellConfig}
              />
            </>
          }
        />
        <Route path="/systems" element={<SystemsPage shellConfig={shellConfig} />} />
        <Route
          path="/favorites"
          element={
            <>
              <PageHeader title="Favorites" />
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
        <Route path="/collections" element={<CollectionsPage shellConfig={shellConfig} />} />
        <Route
          path="/collections/:collectionUuid"
          element={<CollectionDetailPage shellConfig={shellConfig} />}
        />
        <Route path="/news" element={<NewsPage shellConfig={shellConfig} />} />
        <Route path="/wishlist" element={<WishlistPage shellConfig={shellConfig} />} />
        <Route path="/updates" element={<UpdatesPage shellConfig={shellConfig} />} />
        <Route path="/acquire" element={<AcquirePage />} />
        <Route path="/playtime" element={<PlaytimePage shellConfig={shellConfig} />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/members/:userId" element={<MemberProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/calendar" element={<CalendarPage shellConfig={shellConfig} />} />
        <Route path="/ownership" element={<OwnershipPage shellConfig={shellConfig} />} />
        <Route path="/vr" element={<VrPage shellConfig={shellConfig} />} />
        <Route path="/trailers" element={<TrailersPage shellConfig={shellConfig} />} />
        <Route path="/help" element={<HelpPage shellConfig={shellConfig} />} />
        <Route path="/game_details/:gameUuid" element={<GameDetailsPage />} />
      </Route>
    </Routes>
  )
}
