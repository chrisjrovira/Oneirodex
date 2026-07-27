/** Primary admin top nav. */
export const ADMIN_NAV = [
  { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard' },
  { id: 'libraries', path: '/libraries', label: 'Libraries' },
  { id: 'scans', path: '/scan_management', label: 'Scans' },
  { id: 'settings', path: '/admin/settings', label: 'Settings' },
  { id: 'content', path: '/admin/discovery_sections', label: 'Content' },
  { id: 'users', path: '/admin/users', label: 'Users' },
  { id: 'integrations', path: '/admin/integrations', label: 'Integrations' },
  { id: 'system', path: '/admin/ops', label: 'System' },
]

export const SETTINGS_CARDS = [
  { to: '/admin/new_server_settings', title: 'Server Settings', blurb: 'Scan threads, download batching, site URL.' },
  { to: '/admin/attract_mode_settings', title: 'Attract Mode', blurb: 'Idle trailer slideshow and filters.' },
  { to: '/admin/emulator_profiles', title: 'Emulators', blurb: 'WebRetro cores, BIOS, cloud saves.' },
  { to: '/admin/reference_sets', title: 'ROM reference sets', blurb: 'Upload No-Intro/Redump DATs for set completeness.' },
  { to: '/admin/arr', title: 'Arr Module', blurb: 'BYO Prowlarr/Jackett + qBittorrent (no bundled indexers).' },
  { to: '/admin/quality_profiles', title: 'Quality Profiles', blurb: 'Release quality rules.' },
  { to: '/admin/detail_layout', title: 'Detail Layout', blurb: 'Game details field layout.' },
  { to: '/admin/ai', title: 'AI Assist', blurb: 'AI identification and helpers.' },
  { to: '/admin/storage', title: 'Storage', blurb: 'Disk paths, BIOS under userdata/system, assists packs.' },
  { to: '/admin/themes', title: 'Themes', blurb: 'Apply presets; Reset Default Themes.' },
  { to: '/admin/art_studio', title: 'Art studio', blurb: 'Branded cover placeholders — generate, zip, apply.' },
  { to: '/admin/remote_play', title: 'Remote play', blurb: 'BYO Sunshine/Wolf Moonlight host — off by default.' },
  { to: '/admin/plugins', title: 'Plugins', blurb: 'Connector / export / emu registry.' },
]

/** Grouped Integrations hub cards (React chrome; forms stay Jinja). */
export const INTEGRATION_CARDS = [
  {
    id: 'igdb',
    title: 'IGDB',
    blurb: 'Primary game metadata credentials and sync.',
    href: '/admin/igdb_settings',
    links: [
      { href: '/admin/igdb_settings', label: 'IGDB settings' },
      { href: '/admin/integrations#steamgriddb', label: 'SteamGridDB art' },
      { href: '/admin/integrations#giantbomb', label: 'Giant Bomb' },
      { href: '/admin/integrations#hltb', label: 'HowLongToBeat' },
    ],
  },
  {
    id: 'smtp',
    title: 'SMTP',
    blurb: 'Outbound mail for invites, resets, and notices.',
    href: '/admin/smtp_settings',
    links: [{ href: '/admin/smtp_settings', label: 'SMTP settings' }],
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
    id: 'support',
    title: 'Support',
    blurb: 'Member issue inbox and optional GitHub sync.',
    href: '/admin/support',
    links: [{ href: '/admin/support', label: 'Support inbox' }],
  },
]

export const HUB_LINKS = {
  libraries: [
    { href: '/libraries', label: 'Manage libraries' },
    { href: '/admin/library/add', label: 'Add library' },
    { href: '/admin/library_tools', label: 'Library tools' },
    { href: '/admin/filters', label: 'Release filters' },
    { href: '/admin/extensions', label: 'Extensions' },
  ],
  scans: [
    { href: '/scan_management', label: 'Scan jobs' },
    { href: '/admin/image_queue', label: 'Image queue' },
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
  ],
  system: [
    { href: '/admin/ops', label: 'Ops glance' },
    { href: '/admin/server_status_page', label: 'Server status' },
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
