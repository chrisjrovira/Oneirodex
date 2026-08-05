/** Primary admin top nav. */
export const ADMIN_NAV = [
  { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard' },
  // Libraries and scans are one tabbed page (UX-C2) — two top-nav buttons
  // pointing into the same page was the leftover from before they merged.
  { id: 'libraries', path: '/scan_management?active_tab=libraries', label: 'Libraries & scans' },
  { id: 'settings', path: '/admin/settings', label: 'Settings' },
  { id: 'content', path: '/admin/discovery_sections', label: 'Content' },
  { id: 'users', path: '/admin/users', label: 'Users' },
  { id: 'integrations', path: '/admin/integrations', label: 'Integrations' },
  { id: 'system', path: '/admin/ops', label: 'System' },
]

/** Settings rows, grouped like the scans page rather than a flat card grid (UX-C9). */
export const SETTINGS_GROUPS = [
  {
    id: 'library',
    title: 'Library & matching',
    items: [
      { to: '/admin/new_server_settings', title: 'Server settings', blurb: 'Scan threads, download batching, site URL.' },
      {
        to: '/admin/scan_match',
        title: 'Scan / match policy',
        blurb: 'Propose-only, dupe/match thresholds, peel profile — soft-degrades if Backend mid-rollout.',
      },
      { to: '/admin/reference_sets', title: 'ROM reference sets', blurb: 'Upload No-Intro/Redump DATs for set completeness.' },
      { to: '/admin/quality_profiles', title: 'Quality profiles', blurb: 'Release quality rules.' },
      { to: '/admin/storage', title: 'Storage', blurb: 'Same-volume hardlink preview/apply helpers.' },
    ],
  },
  {
    id: 'play',
    title: 'Play & emulation',
    items: [
      { to: '/admin/emulator_profiles', title: 'Emulators', blurb: 'WebRetro cores, BIOS, cloud saves.' },
      { to: '/admin/remote_play', title: 'Remote play', blurb: 'BYO Sunshine/Wolf Moonlight host — off by default.' },
      { to: '/admin/arr', title: 'Arr module', blurb: 'BYO Prowlarr/Jackett + qBittorrent (no bundled indexers).' },
    ],
  },
  {
    id: 'presentation',
    title: 'Presentation',
    items: [
      { to: '/admin/themes', title: 'Themes', blurb: 'Apply presets; Reset Default Themes.' },
      { to: '/admin/art_studio', title: 'Art studio', blurb: 'Placeholders + artwork picker / image queue.' },
      { to: '/admin/detail_layout', title: 'Detail layout', blurb: 'Game details field layout.' },
      { to: '/admin/attract_mode_settings', title: 'Attract mode', blurb: 'Idle trailer slideshow and filters.' },
    ],
  },
  {
    id: 'extend',
    title: 'Extend',
    items: [
      { to: '/admin/ai', title: 'AI assist', blurb: 'AI identification and helpers.' },
      { to: '/admin/plugins', title: 'Plugins', blurb: 'Connector / export / emu registry.' },
    ],
  },
]

/** Flat view — kept so existing links/tests that expect one list keep working. */
export const SETTINGS_CARDS = SETTINGS_GROUPS.flatMap((group) => group.items)

/** Grouped Integrations hub cards (React chrome; forms stay Jinja). */
export const INTEGRATION_CARDS = [
  {
    id: 'igdb',
    title: 'IGDB',
    blurb: 'Primary game metadata credentials and sync.',
    href: '/admin/igdb_settings',
    links: [
      { href: '/admin/igdb_settings', label: 'IGDB settings' },
      { href: '/admin/integrations#igdb', label: 'Integrations · IGDB tab' },
    ],
  },
  {
    id: 'artwork',
    title: 'Artwork & secondary metadata',
    blurb: 'SteamGridDB covers, Giant Bomb, HowLongToBeat, Meta/Quest — not IGDB-only.',
    href: '/admin/integrations#steamgriddb',
    links: [
      { href: '/admin/integrations#steamgriddb', label: 'SteamGridDB art' },
      { href: '/admin/integrations#giantbomb', label: 'Giant Bomb' },
      { href: '/admin/integrations#hltb', label: 'HowLongToBeat' },
      { href: '/admin/integrations#meta_quest', label: 'Meta / Quest ownership' },
      { href: '/admin/art_studio#images', label: 'Art studio picker' },
    ],
  },
  {
    id: 'smtp',
    title: 'SMTP',
    blurb: 'Outbound mail for invites, resets, and notices.',
    href: '/admin/smtp_settings',
    links: [
      { href: '/admin/smtp_settings', label: 'SMTP settings' },
      { href: '/admin/integrations#email', label: 'Integrations · Email tab' },
    ],
  },
  {
    id: 'oidc',
    title: 'OIDC',
    blurb: 'Optional SSO (Authentik). Leave off for home-only installs.',
    href: '/admin/integrations#oidc',
    links: [{ href: '/admin/integrations#oidc', label: 'OIDC / SSO tab' }],
  },
  {
    id: 'livekit',
    title: 'LiveKit',
    blurb: 'Household voice rooms — enable under Features + LIVEKIT_* secrets.',
    href: '/admin/features',
    links: [
      { href: '/admin/features', label: 'Features (LiveKit toggle)' },
      { href: '/admin/ops', label: 'Ops voice pulse' },
    ],
  },
  {
    id: 'community',
    title: 'Community chat',
    blurb: 'Optional BYO Stoat/Matrix deep-link — not Discord webhooks.',
    href: '/admin/integrations#community',
    links: [
      { href: '/admin/integrations#community', label: 'Community tab' },
      { href: '/admin/chat_emoji', label: 'Custom chat emoji' },
    ],
  },
  {
    id: 'acquire',
    title: 'Acquire / Arr',
    blurb: 'Native Torznab registry + optional Prowlarr/Jackett/qBit hubs.',
    href: '/admin/arr',
    links: [
      { href: '/admin/arr', label: 'Arr module' },
      { href: '/admin/integrations#indexers', label: 'Integrations · Indexers' },
    ],
  },
  {
    id: 'ownership',
    title: 'Ownership registers',
    blurb: 'Store ownership sync is register-only — no DRM download queues.',
    href: '/admin/integrations#ownership',
    links: [
      { href: '/admin/integrations#ownership', label: 'Ownership tab' },
      { href: '/admin/integrations#meta_quest', label: 'Meta / Quest' },
    ],
  },
  {
    id: 'remote_play',
    title: 'Remote play',
    blurb: 'BYO Sunshine/Wolf for Moonlight — enable under Features + host URL.',
    href: '/admin/remote_play',
    links: [
      { href: '/admin/remote_play', label: 'Remote play settings' },
      { href: '/admin/features', label: 'Features toggle' },
    ],
  },
  {
    id: 'exports',
    title: 'Export packs',
    blurb:
      'ES-DE gamelist.xml and Pegasus metadata for external frontends. Portable paths only — no NAS mount leaks.',
    href: '/admin/plugins',
    links: [
      { href: '/api/export/esde', label: 'Download ES-DE gamelist.xml' },
      { href: '/api/export/pegasus?platform=Library', label: 'Download Pegasus metadata' },
      { href: '/admin/plugins', label: 'Plugins registry' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    blurb: 'Member issue inbox and optional GitHub sync.',
    href: '/admin/support',
    links: [{ href: '/admin/support', label: 'Support inbox' }],
  },
]

export const HUB_LINKS = {
  // One hub for the merged page (UX-C2): library management and scan jobs are
  // tabs of the same screen, so they share one link list.
  libraries: [
    { href: '/scan_management?active_tab=libraries', label: 'Libraries' },
    { href: '/scan_management', label: 'Scan jobs' },
    // Named for what they do, not how (UX-C4). Bulk add already existed via
    // these two flows, but "propose/import leaf libraries" did not read as
    // "add several at once", so the single-library form looked like the only way.
    { href: '/admin/library/add', label: 'Add one library' },
    { href: '/libraries#propose-leaf', label: 'Add many — scan a folder for libraries' },
    { href: '/libraries#import-leaf', label: 'Add many — import CSV / JSON' },
    { href: '/admin/library_tools', label: 'Library tools' },
    { href: '/admin/edit_filters', label: 'Release filters' },
    { href: '/admin/extensions', label: 'Extensions' },
    { href: '/admin/art_studio#images', label: 'Art & images' },
    { href: '/admin/image_queue', label: 'Image queue (classic)' },
  ],
  users: [
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/manage_users', label: 'Classic editor' },
    { href: '/admin/invites', label: 'Invites' },
    { href: '/admin/whitelist', label: 'Whitelist' },
    { href: '/admin/support', label: 'Support inbox' },
  ],
  integrations: [
    { href: '/admin/integrations', label: 'Integrations hub' },
    { href: '/admin/smtp_settings', label: 'SMTP' },
    { href: '/admin/igdb_settings', label: 'IGDB metadata' },
    { href: '/admin/integrations#oidc', label: 'OIDC / SSO' },
    { href: '/admin/features', label: 'LiveKit (Features)' },
    { href: '/admin/support', label: 'Support inbox' },
    { href: '/admin/integrations#steamgriddb', label: 'SteamGridDB art' },
    { href: '/admin/integrations#giantbomb', label: 'Giant Bomb' },
    { href: '/admin/integrations#hltb', label: 'HowLongToBeat' },
    { href: '/admin/integrations#meta_quest', label: 'Meta / Quest' },
    { href: '/admin/integrations#ownership', label: 'Ownership registers' },
    { href: '/admin/integrations#community', label: 'Community chat' },
    { href: '/admin/arr', label: 'Acquire / Arr' },
    { href: '/api/export/esde', label: 'ES-DE export' },
    { href: '/api/export/pegasus?platform=Library', label: 'Pegasus export' },
  ],
  system: [
    // Server status is no longer its own section (UX-C1) — its signals live on
    // the dashboard, so the standalone page is not offered as a destination.
    { href: '/admin/ops', label: 'Ops glance' },
    { href: '/admin/new_server_info', label: 'Server info' },
    { href: '/admin/server_logs', label: 'Server logs' },
    { href: '/admin/statistics', label: 'Statistics' },
    { href: '/admin/manage-downloads', label: 'Downloads admin' },
    { href: '/admin/help', label: 'Admin help' },
  ],
  content: [
    { href: '/admin/discovery_sections', label: 'Discovery sections' },
    { href: '/admin/newsletter', label: 'Newsletter' },
    { href: '/admin/announcements', label: 'Announcements' },
    { href: '/admin/attract_mode_settings', label: 'Attract mode' },
  ],
}
