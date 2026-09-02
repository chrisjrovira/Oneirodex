import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { CommandPalette } from './chrome/CommandPalette'
import { ScrollJump } from './chrome/ScrollJump'
import { LoadingOverlay } from './components/LoadingOverlay'
import { SideRail } from './chrome/SideRail'
import { applyTileSizeCssVars } from './chrome/TileSizeControl'
import { TopBar } from './chrome/TopBar'
import { useRailState } from '../../shared/useRailState'
import { ChatSlideOut } from './components/ChatSlideOut'
import { SocialCompanionDock } from './components/SocialCompanionDock'
import { isPopoutWindow, requestOpenChatPanel } from './hooks/chatPanelApi'
import { requestOpenSocialCompanion } from './hooks/socialCompanionApi'
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
const DiscoverHubPage = lazy(() =>
  import('./pages/DiscoverHubPage').then((m) => ({ default: m.DiscoverHubPage })),
)
const DiscoverRowPage = lazy(() =>
  import('./pages/DiscoverRowPage').then((m) => ({ default: m.DiscoverRowPage })),
)
const WaysToPlayPage = lazy(() =>
  import('./pages/WaysToPlayPage').then((m) => ({ default: m.WaysToPlayPage })),
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
const LicensedCatalogPage = lazy(() =>
  import('./pages/LicensedCatalogPage').then((m) => ({ default: m.LicensedCatalogPage })),
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

/**
 * Route fallback that holds the layout (GT-B9).
 *
 * This used to be a single line of text. Navigating to any lazy route therefore
 * collapsed the whole content pane to one line and expanded it again a frame
 * later — the "page vanishes for a split second" flash, and the reason text
 * appears to jump on every navigation. The height reservation is the fix; the
 * overlay is just so the wait is legible.
 */
function RouteFallback() {
  return (
    <div className="od-route-fallback" role="status" aria-live="polite">
      <LoadingOverlay active blocking delayMs={120} label="Loading…" />
    </div>
  )
}

function LazyPage({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function Layout({ shellConfig, tileSize, onTileSizeChange }) {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { railState, drawerOpen, toggle: toggleRail, closeDrawer } = useRailState()
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
  // Pop-out windows render the route alone (GT-B17): no rail, no top bar, no
  // dock. They are small by definition, and the chrome is navigation for a
  // session that already has a main window.
  if (isPopoutWindow()) {
    return (
      /* A chat client, not the site with its chrome removed.
         The pop-out was a bare <main>, which at 420px read as a panel but on a
         maximised window simply became the normal page with no navigation —
         "just another instance of the site". `od-popout` gives it its own
         identity at any width: a titled surface that stays a chat client
         rather than a page that lost its bars. */
      <div className="od-popout" data-surface="chat">
        <header className="od-popout__bar">
          <span className="od-popout__mark od-brand-mark" aria-hidden="true" />
          <span className="od-popout__title">Chat</span>
        </header>
        <main id="main-content" className="od-popout-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    )
  }

  // Chat is a client, not a page with controls: bar two has nothing to hold
  // there, so the shell drops its top bar row and gives the height to the
  // conversation. The rail stays — you still need a way out.
  const chatSurface = location.pathname.startsWith('/chat')

  return (
    <div
      className="od-shell"
      data-rail={railState}
      data-surface={chatSurface ? 'chat' : undefined}
    >
      <a className="od-skip-link" href="#main-content">
        Skip to main content
      </a>
      <SideRail
        shellConfig={shellConfig}
        railState={railState}
        onCloseDrawer={closeDrawer}
        onNavigate={(link) => {
          // Chat and Friends are panels, not routes, but they are destinations
          // to the member so the rail lists them alongside the routed ones.
          if (link.action === 'open-chat') requestOpenChatPanel()
          if (link.action === 'open-friends') requestOpenSocialCompanion()
        }}
        footer={<ScrollJump />}
      />
      {drawerOpen ? (
        <button
          type="button"
          className="od-rail__scrim"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      ) : null}
      {chatSurface ? null : (
        <TopBar
          shellConfig={shellConfig}
          tileSize={tileSize}
          onTileSizeChange={onTileSizeChange}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onToggleRail={toggleRail}
          railState={railState}
        />
      )}
      <CommandPalette
        shellConfig={shellConfig}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
      <main id="main-content" className="od-shell__main" tabIndex={-1}>
        <Outlet />
      </main>
      {!hideDock ? (
        <>
          {/* Both mount without their own launchers (W27-A2): the rail carries
              Chat and Friends now, so a floating button in the bottom-right is
              a second control for a destination already listed — and it sat on
              top of the content while it was there.

              The dock has to be mounted even though nothing here renders it
              visibly: it is what listens for OPEN_SOCIAL_EVENT. Without it the
              rail's Friends entry dispatched the event into an empty room and
              did nothing at all (W27-A7). */}
          <ChatSlideOut
            canCreateRooms={canCreateRooms}
            viewer={chatViewer}
            hideLauncher
          />
          {/* gameUuid still rides along: only the launcher moved to the rail.
              Without it the dock's game-scoped half — "Invite to play", "Share
              this game" — is inert on the one page it exists for, because both
              bail out on an empty uuid. */}
          <SocialCompanionDock hideLauncher gameUuid={dockGameUuid} />
        </>
      ) : null}
    </div>
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
          path="/discover/hub/genre/:genre"
          element={
            <LazyPage>
              <DiscoverHubPage
                isAdmin={Boolean(shellConfig.isAdmin)}
                shellConfig={shellConfig}
              />
            </LazyPage>
          }
        />
        <Route
          path="/discover/:identifier"
          element={
            <DiscoverRowPage
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
          path="/ways-to-play"
          element={
            <LazyPage>
              <WaysToPlayPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/systems/completion"
          element={
            <LazyPage>
              <SetCompletionPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/systems/catalog"
          element={
            <LazyPage>
              <LicensedCatalogPage shellConfig={shellConfig} />
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
              <ActivityPage shellConfig={shellConfig} />
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
              <NotificationsPage shellConfig={shellConfig} />
            </LazyPage>
          }
        />
        <Route
          path="/chat"
          element={
            <LazyPage>
              {/* shellConfig, because in a pop-out this route *is* the app and
                  the panel needs the viewer it would otherwise get from the
                  dock. See ChatPage. */}
              <ChatPage shellConfig={shellConfig} />
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
