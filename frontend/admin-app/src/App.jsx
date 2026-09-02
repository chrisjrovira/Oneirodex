import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useRailState } from '../../shared/useRailState'
import { AdminSideRail } from './AdminSideRail'
import { AdminTopNav } from './AdminTopNav'
import { useAdminShellFrame } from './useAdminShellFrame'
import { useLegacyContextbarPortal } from './useLegacyContextbarPortal'
import { useLibrariesContextbarUnfurl } from './useLibrariesContextbarUnfurl'
import { useLibrariesPanelMount } from './useLibrariesPanelMount'
import { useLibraryScanToasts } from './useLibraryScanToasts'
import { AnnouncementsPage } from './AnnouncementsPage'
import { SupportInboxPage } from './SupportInboxPage'
import { InvitesPage } from './InvitesPage'
import { UsersPage } from './UsersPage'
import { OpsPage } from './OpsPage'
import { SystemDangerPage } from './SystemDangerPage'
import { ArtStudioPage } from './ArtStudioPage'
import { ImagesPage } from './ImagesPage'
import { RemotePlayPage } from './RemotePlayPage'
import { QualityProfilesPage } from './QualityProfilesPage'
import { StoragePage } from './StoragePage'
import { ScanMatchSettingsPage } from './ScanMatchSettingsPage'
import { ExtensionsPage } from './ExtensionsPage'
import { SETTINGS_CARDS, railDestinations } from './navConfig'
import './ops.css'
import {
  DashboardPage,
  HelpPage,
  HubPage,
  IntegrationsPage,
  LibrariesPage,
  PluginsPage,
  ScansPage,
  SettingsPage,
  ThemesPage,
  resolveAdminPage,
} from './pages'

/**
 * Legacy fallback only — see resolveRenderMode.
 *
 * Kept for templates that have not yet declared data-admin-render. Do not add
 * selectors here; migrate the template to `spa` or `legacy` instead.
 */
function hasLegacyBody() {
  const legacy = document.getElementById('admin-legacy-content')
  if (!legacy) {
    return false
  }
  const text = (legacy.textContent || '').replace(/\s+/g, ' ').trim()
  if (text.length < 40) {
    return false
  }
  return Boolean(
    legacy.querySelector(
      'form, table, .od-adminpage, .od-admin-card, .settings-shell, .settings-shell-cards, .settings-shell-card, .container-settings-dashboard, .container, .card, .datatable, #proposalsList, .admin-page, .admin-section',
    ),
  )
}

/**
 * Which body should render (GT-A3).
 *
 * The template declares intent via `data-admin-render` on #admin-app-root.
 * Previously this was inferred at runtime by sniffing the Jinja body for
 * `form, table, .card, .container, …` — so an unrelated markup change in a
 * template could silently delete the React page for that route, and whether a
 * given admin screen looked React or Bootstrap was not knowable from the source.
 *
 * `auto` preserves the old behaviour for templates not yet migrated, so this
 * can land without touching all 47 admin templates at once.
 *
 * @returns {'spa'|'legacy'} which body to render
 */
export function resolveRenderMode(root = document.getElementById('admin-app-root')) {
  const declared = root?.dataset?.adminRender

  if (declared === 'spa') return 'spa'
  if (declared === 'legacy') return 'legacy'

  if (declared && declared !== 'auto' && typeof console !== 'undefined') {
    console.warn(
      `[admin] unknown data-admin-render="${declared}" — falling back to auto detection`,
    )
  }

  return hasLegacyBody() ? 'legacy' : 'spa'
}

function SettingsSectionPage() {
  const { pathname } = useLocation()
  const card = SETTINGS_CARDS.find((c) => c.to === pathname)
  // This renders only when a settings module has no React body yet, so without
  // a link out it is a titled blank panel. The card knows its own destination;
  // offering it is the difference between a landing page and a dead end.
  return (
    <HubPage
      title={card?.title || 'Settings module'}
      lede={card?.blurb || 'Server module settings.'}
      links={card ? [{ href: card.to, label: `Open ${card.title}` }] : []}
    />
  )
}

function RoutedAdminPage() {
  const { pathname } = useLocation()
  const kind = resolveAdminPage(pathname)

  switch (kind) {
    case 'dashboard':
      return <DashboardPage />
    case 'libraries':
      return <LibrariesPage />
    case 'settings':
      return <SettingsPage />
    case 'themes':
      return <ThemesPage />
    case 'art_studio':
      return <ArtStudioPage />
    case 'images':
      return <ImagesPage />
    case 'remote_play':
      return <RemotePlayPage />
    case 'quality_profiles':
      return <QualityProfilesPage />
    case 'storage':
      return <StoragePage />
    case 'scan_match':
      return <ScanMatchSettingsPage />
    case 'extensions':
      return <ExtensionsPage />
    case 'help':
      return <HelpPage />
    case 'plugins':
      return <PluginsPage />
    case 'scans':
      return <ScansPage />
    case 'users':
      return <UsersPage />
    case 'system':
      return <OpsPage />
    case 'system-danger':
      return <SystemDangerPage />
    case 'integrations':
      return <IntegrationsPage />
    case 'content':
      return (
        <HubPage
          title="Content"
          lede="Discovery shelves, newsletter, announcements, and attract mode."
          links={railDestinations('content')}
        />
      )
    case 'announcements':
      return <AnnouncementsPage />
    case 'support':
      return <SupportInboxPage />
    case 'invites':
      return <InvitesPage />
    case 'settings-section':
      return <SettingsSectionPage />
    default:
      return (
        <HubPage
          title="Admin"
          lede="Pick a section from the rail on the left."
        />
      )
  }
}

export function App() {
  const legacy = resolveRenderMode() === 'legacy'
  const { railState, drawerOpen, toggle: toggleRail, closeDrawer } = useRailState()

  useAdminShellFrame(railState)
  useLibraryScanToasts({ enabled: true })
  // Jinja chrome.contextbar → thin top bar (member ContextBar parity).
  useLegacyContextbarPortal(legacy)
  useLibrariesContextbarUnfurl(legacy)
  useLibrariesPanelMount(legacy)

  // SPA pages: park #admin-legacy-content so it cannot steal the main grid
  // cell (whitespace used to keep it painted as a dead column). Legacy Jinja
  // pages keep it visible — that is their body.
  useEffect(() => {
    const node = document.getElementById('admin-legacy-content')
    if (!node) return undefined
    if (legacy) {
      node.hidden = false
      node.classList.remove('is-spa-idle')
    } else {
      node.hidden = true
      node.classList.add('is-spa-idle')
    }
    return undefined
  }, [legacy])

  return (
    <div className="od-admin-shell">
      <AdminSideRail railState={railState} onCloseDrawer={closeDrawer} />
      {drawerOpen ? (
        <button
          type="button"
          className="od-rail__scrim"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      ) : null}
      <AdminTopNav onToggleRail={toggleRail} railState={railState} />
      {!legacy ? (
        <main className="od-admin-main">
          <Routes>
            <Route path="*" element={<RoutedAdminPage />} />
          </Routes>
        </main>
      ) : null}
    </div>
  )
}
