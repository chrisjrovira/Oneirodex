import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { CommandPalette } from './chrome/CommandPalette'
import { ScrollJump } from './chrome/ScrollJump'
import { applyTileSizeCssVars } from './chrome/TileSizeControl'
import { TopNav } from './chrome/TopNav'
import { ChatSlideOut } from './components/ChatSlideOut'
import { SocialCompanionDock } from './components/SocialCompanionDock'
import { useLibraryScanToasts } from './hooks/useLibraryScanToasts'
import { DiscoverApp } from './DiscoverApp'
import { FavoritesApp } from './FavoritesApp'
import { LibraryApp } from './LibraryApp'
import { SystemsPage } from './pages/SystemsPage'
import { GameDetailsPage } from './pages/GameDetailsPage'
import './pages/MorePage.css'
import './chrome/platformSkins.css'
import './chrome/glass.css'
import './chrome/mobile-density.css'
import './chrome/TopNav.css'

const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const SocialCompanionPage = lazy(() =>
  import('./pages/SocialCompanionPage').then((m) => ({ default: m.SocialCompanionPage })),
)
const MemberProfilePage = lazy(() =>
  import('./pages/MemberProfilePage').then((m) => ({ default: m.MemberProfilePage })),
)
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
)
const ReportIssuePage = lazy(() =>
  import('./pages/ReportIssuePage').then((m) => ({ default: m.ReportIssuePage })),
)
const AcquirePage = lazy(() =>
  import('./pages/AcquirePage').then((m) => ({ default: m.AcquirePage })),
)
const BigPicturePage = lazy(() =>
  import('./pages/BigPicturePage').then((m) => ({ default: m.BigPicturePage })),
)
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const CollectionDetailPage = lazy(() =>
  import('./pages/CollectionDetailPage').then((m) => ({ default: m.CollectionDetailPage })),
)
const CollectionsPage = lazy(() =>
  import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })),
)
const DownloadsPage = lazy(() =>
  import('./pages/DownloadsPage').then((m) => ({ default: m.DownloadsPage })),
)
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })))
const NewsPage = lazy(() => import('./pages/NewsPage').then((m) => ({ default: m.NewsPage })))
const OwnershipPage = lazy(() =>
  import('./pages/OwnershipPage').then((m) => ({ default: m.OwnershipPage })),
)
const PlaytimePage = lazy(() =>
  import('./pages/PlaytimePage').then((m) => ({ default: m.PlaytimePage })),
)
const TrailersPage = lazy(() =>
  import('./pages/TrailersPage').then((m) => ({ default: m.TrailersPage })),
)
const UpdatesPage = lazy(() =>
  import('./pages/UpdatesPage').then((m) => ({ default: m.UpdatesPage })),
)
const VrPage = lazy(() => import('./pages/VrPage').then((m) => ({ default: m.VrPage })))
const WishlistPage = lazy(() =>
  import('./pages/WishlistPage').then((m) => ({ default: m.WishlistPage })),
)
const TokensPage = lazy(() =>
  import('./pages/TokensPage').then((m) => ({ default: m.TokensPage })),
)
const SetCompletionPage = lazy(() =>
  import('./pages/SetCompletionPage').then((m) => ({ default: m.SetCompletionPage })),
)

function libraryInitialConfig(shellConfig) {
  return {
    perPage: Number(shellConfig.perPage) || 50,
    defaultSort: shellConfig.defaultSort || 'name',
    defaultSortOrder: shellConfig.defaultSortOrder || 'asc',
    isAdmin: Boolean(shellConfig.isAdmin),
    showPlayStatus: Boolean(shellConfig.showPlayStatus),
    libraryCount: Number(shellConfig.libraryCount) || 0,
    gamesCount: Number(shellConfig.gamesCount) || 0,
    enableDeleteOnDisk: Boolean(shellConfig.enableDeleteOnDisk),
    locale: shellConfig.locale || 'en',
    currentFilters: shellConfig.currentFilters || {},
  }
}

function RouteFallback() {
  return <p className="gt-more-page__lede">Loading…</p>
}

function LazyPage({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function Layout({ shellConfig, tileSize, onTileSizeChange }) {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const hideDock = location.pathname.startsWith('/social-companion')
  const detailsMatch = location.pathname.match(/^\/game_details\/([^/]+)/)
  const dockGameUuid = detailsMatch?.[1] || ''
  // Soft-fail when Backend watch/scan notification kind is not ready yet.
  useLibraryScanToasts({ enabled: true })
  // Admins create rooms; librarians also allowed by API — UI still shows form and surfaces 403.
  const canCreateRooms = true
  const chatViewer = {
    userId: shellConfig.userId ?? null,
    isLibrarian: Boolean(shellConfig.isLibrarian),
    isAdmin: Boolean(shellConfig.isAdmin),
    role: shellConfig.role || 'user',
  }
  return (
    <>
      <a className="gt-skip-link" href="#main-content">
        Skip to main content
      </a>
      <TopNav
        shellConfig={shellConfig}
        tileSize={tileSize}
        onTileSizeChange={onTileSizeChange}
        onOpenCommandPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        shellConfig={shellConfig}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
      <main id="main-content" className="gt-main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <ScrollJump />
      {!hideDock ? (
        <>
          <ChatSlideOut canCreateRooms={canCreateRooms} viewer={chatViewer} />
          <SocialCompanionDock mode="dock" gameUuid={dockGameUuid} />
        </>
      ) : null}
    </>
  )
}

export function App({ shellConfig = {} }) {
  const [tileSize, setTileSize] = useState(shellConfig.tileSize || '50')

  useEffect(() => {
    applyTileSizeCssVars(tileSize)
    let timer = 0
    function onResize() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => applyTileSizeCssVars(tileSize), 100)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [tileSize])

  return (
    <Routes>
      <Route
        path="/big-picture"
        element={
          <LazyPage>
            <BigPicturePage shellConfig={shellConfig} />
          </LazyPage>
        }
      />
      <Route
        path="/social-companion"
        element={
          <LazyPage>
            <SocialCompanionPage />
          </LazyPage>
        }
      />
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
            <DiscoverApp
              isAdmin={Boolean(shellConfig.isAdmin)}
              shellConfig={shellConfig}
            />
          }
        />
        <Route
          path="/library"
          element={
            <LibraryApp
              initialConfig={libraryInitialConfig(shellConfig)}
              shellConfig={shellConfig}
            />
          }
        />
        <Route path="/systems" element={<SystemsPage shellConfig={shellConfig} />} />
        <Route
          path="/systems/completion"
          element={
            <LazyPage>
              <SetCompletionPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/favorites"
          element={
            <FavoritesApp
              initialConfig={{
                isAdmin: Boolean(shellConfig.isAdmin),
                showPlayStatus: Boolean(shellConfig.showPlayStatus),
              }}
              shellConfig={shellConfig}
            />
          }
        />
        <Route
          path="/downloads"
          element={
            <LazyPage>
              <DownloadsPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/collections"
          element={
            <LazyPage>
              <CollectionsPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/collections/:collectionUuid"
          element={
            <LazyPage>
              <CollectionDetailPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/news"
          element={
            <LazyPage>
              <NewsPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/wishlist"
          element={
            <LazyPage>
              <WishlistPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/updates"
          element={
            <LazyPage>
              <UpdatesPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/acquire"
          element={
            <LazyPage>
              <AcquirePage />
            </LazyPage>
          }
        />
        <Route
          path="/playtime"
          element={
            <LazyPage>
              <PlaytimePage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/activity"
          element={
            <LazyPage>
              <ActivityPage />
            </LazyPage>
          }
        />
        <Route
          path="/members/:userId"
          element={
            <LazyPage>
              <MemberProfilePage />
            </LazyPage>
          }
        />
        <Route
          path="/notifications"
          element={
            <LazyPage>
              <NotificationsPage />
            </LazyPage>
          }
        />
        <Route
          path="/chat"
          element={
            <LazyPage>
              <ChatPage />
            </LazyPage>
          }
        />
        <Route
          path="/report"
          element={
            <LazyPage>
              <ReportIssuePage />
            </LazyPage>
          }
        />
        <Route
          path="/calendar"
          element={
            <LazyPage>
              <CalendarPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/ownership"
          element={
            <LazyPage>
              <OwnershipPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/tokens"
          element={
            <LazyPage>
              <TokensPage />
            </LazyPage>
          }
        />
        <Route
          path="/vr"
          element={
            <LazyPage>
              <VrPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/trailers"
          element={
            <LazyPage>
              <TrailersPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/help"
          element={
            <LazyPage>
              <HelpPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route path="/game_details/:gameUuid" element={<GameDetailsPage />} />
      </Route>
    </Routes>
  )
}
