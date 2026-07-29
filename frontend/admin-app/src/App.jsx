import { Route, Routes, useLocation } from 'react-router-dom'
import { AdminTopNav } from './AdminTopNav'
import { AnnouncementsPage } from './AnnouncementsPage'
import { SupportInboxPage } from './SupportInboxPage'
import { InvitesPage } from './InvitesPage'
import { UsersPage } from './UsersPage'
import { OpsPage } from './OpsPage'
import { ArtStudioPage } from './ArtStudioPage'
import { ImagesPage } from './ImagesPage'
import { RemotePlayPage } from './RemotePlayPage'
import { HUB_LINKS, SETTINGS_CARDS } from './navConfig'
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
      'form, table, .gt-adminpage, .gt-admin-card, .settings-shell, .settings-shell-cards, .settings-shell-card, .container-settings-dashboard, .container, .card, .datatable, #proposalsList, .admin-page, .admin-section',
    ),
  )
}

function SettingsSectionPage() {
  const { pathname } = useLocation()
  const card = SETTINGS_CARDS.find((c) => c.to === pathname)
  return (
    <HubPage
      title={card?.title || 'Settings module'}
      lede={card?.blurb || 'Server module settings.'}
      links={[
        { href: '/admin/settings', label: 'Back to settings hub' },
        ...(card ? [{ href: card.to, label: 'Reload' }] : []),
      ]}
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
    case 'integrations':
      return <IntegrationsPage />
    case 'content':
      return (
        <HubPage
          title="Content"
          lede="Discovery shelves, newsletter, announcements, and attract mode."
          links={HUB_LINKS.content}
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
          lede="React admin shell — pick a section from the top bar."
          links={[
            { href: '/admin/dashboard', label: 'Dashboard' },
            { href: '/admin/settings', label: 'Settings' },
            { href: '/admin/help', label: 'Help' },
          ]}
        />
      )
  }
}

export function App() {
  const legacy = hasLegacyBody()

  return (
    <div className="gt-admin-shell">
      <AdminTopNav />
      {!legacy ? (
        <main className="gt-admin-main">
          <Routes>
            <Route path="*" element={<RoutedAdminPage />} />
          </Routes>
        </main>
      ) : null}
    </div>
  )
}
