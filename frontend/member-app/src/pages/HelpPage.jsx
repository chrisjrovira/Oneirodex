import { useState } from 'react'

const FAQ_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      'Use the top navigation for Discover, Library, Systems, Downloads, and Favorites.',
      'Press Ctrl+K (⌘K on Mac) or Search in the top nav to open the command palette and jump to any page.',
      'Open More for Collections, Wishlist, Ownership, Big Picture, and other hubs.',
      'Press any key on Library to focus search, then filter by genre, platform, or release date.',
      'Click a cover to open game details, screenshots, and download options.',
      'If the site will not load, ask an admin to check /healthz (up) and /readyz (DB ready); Admins also use Ops → Services.',
    ],
  },
  {
    id: 'systems',
    title: 'Systems & themes',
    items: [
      'Open Systems to browse by console or PC; each tile filters the library to that platform.',
      'Library badge chips include VR, UPDATE, OUT/~, NEW, RELEASE, and LANG (ROM language mismatch vs Preferences → Preferred game language).',
      'Inside a system, chrome accents and button motion follow that console family (Nintendo, Sony, Xbox, Sega, Retro, PC).',
      'All-library / global search keeps the default green glass look.',
      'Change themes in Preferences; after apply, hard-refresh so volume CSS loads.',
    ],
  },
  {
    id: 'downloads',
    title: 'Downloads',
    items: [
      'Use Download on a game page to start a zip on the server.',
      'Some downloads need processing time before the file is ready.',
      'Track progress under Downloads in the top nav.',
      'Files stay available until you or an admin remove them.',
    ],
  },
  {
    id: 'library',
    title: 'Your Library',
    items: [
      'Favorite games with the heart on a cover tile.',
      'Open Favorites from the top nav for a quick shelf.',
      'Use badge chips (including LANG) above the filter bar to narrow by update/freshness/language signals.',
      'Adjust tile size from the control in the page header or top nav.',
      'Customize accent themes and display options in Preferences (account menu).',
    ],
  },
  {
    id: 'social',
    title: 'Social & voice',
    items: [
      'Friends pill (bottom-right) or More → Friends window for a stay-open friends list, DMs, and party invite — Pop out opens /social-companion.',
      'More → Activity for presence and the optional LiveKit voice lobby.',
      'More → Chat for household channels and DMs; react with emoji and search messages.',
      'More → Notifications for alerts (optional email for mentions/DMs).',
      'Voice needs the admin to enable LiveKit; otherwise use Community chat (Stoat/Matrix) if configured.',
      'GameTheca does not use Discord bots or webhooks — chat, notifications, optional LiveKit, or BYO Stoat/Matrix only.',
    ],
  },
  {
    id: 'free-games',
    title: 'Free games',
    items: [
      'News → Free now lists current Steam / Epic / GOG / Amazon / itch / Humble free claims.',
      'Claim opens the store page; if that store is linked under Ownership, you may also Open in app or Sync ownership.',
      'GameTheca never downloads DRM titles for you — Sync ownership updates badges after you claim on the store.',
      'Opt out of free-game alerts under Notifications → Preferences.',
    ],
  },
  {
    id: 'translations',
    title: 'Translations & patches',
    items: [
      'Preferences → Preferred game language (default en-US) is separate from UI language.',
      'Game details show ROM region/language chips when filenames include No-Intro-style tags.',
      'Library LANG chip / LANG badge filters and marks titles that may not match your preferred language; PATCH marks curated extras.',
      'When the ROM may not match your preference, open Translations & patches for .ips/.bps/.ups extras.',
      'Apply patches with Flips and keep a backup of the original ROM — see docs/user/translation-patches.md.',
      'No fan patch? Companion/native RetroArch can use AI Service live OCR/MT overlay when the operator enables ENABLE_ROM_AI_TRANSLATE.',
      'Admins can search an operator-owned local patch guide catalog (ENABLE_PATCH_CATALOG) — GameTheca never scrapes third-party DBs.',
      'Companion “Apply with companion” appears only when the operator enables ENABLE_ROM_PATCH_APPLY and Flips is configured.',
    ],
  },
  {
    id: 'controllers-vr',
    title: 'Controllers & VR',
    items: [
      'More → Big Picture for gamepad-first browse: A open, X download, B Attract, Y Friends, Esc exit (DualSense: × □ ○ △).',
      'Steam Deck / Steam Input can remap the browser if you launch it from Steam — GameTheca uses the standard Gamepad API.',
      'VR browse (/vr when enabled) is headset-friendly for any seat — not Quest-only. PSVR2/SteamVR: use a desktop browser on the PC + Big Picture with a normal pad.',
      'Quest / standalone: open /vr in the headset browser (optional Add to Home). Play heavy PC titles via Moonlight to the household host.',
      'Sense / VR controllers are for SteamVR games; they do not reliably drive the GameTheca website.',
    ],
  },
  {
    id: 'support',
    title: 'Need Help?',
    items: [
      'More → Report issue to file a ticket for maintainers (syncs to GitHub when configured).',
      'Member FAQ & troubleshooting: ask your admin for the docs/user guides, or see the GitHub repo.',
      'Repo: https://github.com/chrisjrovira/gametheca',
    ],
  },
]

export function HelpPage() {
  const [openIds, setOpenIds] = useState(() => new Set(FAQ_SECTIONS.map((s) => s.id)))

  function toggle(id) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="gt-more-page gt-help">
      <div className="gt-page-header">
        <h1>Help & FAQ</h1>
      </div>
      <p className="gt-more-page__lede">Your guide to the GameTheca member library</p>

      <div className="gt-help__sections">
        {FAQ_SECTIONS.map((section) => {
          const open = openIds.has(section.id)
          return (
            <section key={section.id} className="gt-help__section">
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(section.id)}
                >
                  {section.title}
                </button>
              </h2>
              {open ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
