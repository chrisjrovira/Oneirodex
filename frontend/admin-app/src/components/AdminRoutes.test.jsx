import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AdminRoutes } from './AdminRoutes'

/**
 * PR-4 (c): the explicit route table must render, for every path, the same page
 * the old `resolveAdminPage` → `renderAdminKind` switch returned. This is the
 * "no URL changed" guard — one row per branch of the old switch.
 */

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

function mountAt(path) {
  // Pages fire data fetches on mount; a generic empty-OK stub keeps them from
  // throwing while we assert on the synchronous <h1>.
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  }))
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminRoutes />
    </MemoryRouter>,
  )
}

const CASES = [
  ['/admin', 'Dashboard'],
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/support', 'Support inbox'],
  ['/admin/invites', 'Invites'],
  ['/admin/settings', 'Settings'],
  ['/admin/storage', 'Storage / hardlinks'],
  ['/admin/scan_match', 'Scan / match policy'],
  ['/admin/remote_play', 'Remote play'],
  ['/admin/quality_profiles', 'Quality Profiles'],
  ['/admin/announcements', 'Announcements'],
  ['/admin/art_studio', 'Art studio'],
  ['/admin/images', 'Art & images'],
  ['/admin/extensions', 'File Extensions'],
  ['/admin/ops', 'Ops'],
  ['/admin/ops/history', 'Ops'],
  // libraries family — every legacy prefix folds onto LibrariesPage
  ['/libraries', 'Libraries & scans'],
  ['/scan_management?active_tab=libraries', 'Libraries & scans'],
  ['/admin/library/tools', 'Libraries & scans'],
  // settings modules with no React body yet -> SettingsSectionPage, which
  // titles itself from the matching SETTINGS_CARDS entry (same as the old switch).
  ['/admin/ai', 'AI assist'],
  ['/admin/detail_layout', 'Detail layout'],
  // unknown admin path -> the old switch default
  ['/admin/something-unrouted', 'Admin'],
]

describe('AdminRoutes path -> page', () => {
  test.each(CASES)('%s renders "%s"', (path, heading) => {
    mountAt(path)
    expect(screen.getByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
  })

  test('catch-all lede matches the old switch default', () => {
    mountAt('/admin/nope')
    expect(screen.getByText('Pick a section from the rail on the left.')).toBeInTheDocument()
  })
})
