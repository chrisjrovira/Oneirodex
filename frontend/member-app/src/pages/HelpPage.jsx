import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './HelpPage.css'

const FAQ_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Nav, Cmd+K, details, health checks',
    items: [
      'Top nav: Discover, Library, Systems, Downloads, Favorites.',
      'Ctrl+K / ⌘K (or Search) opens the command palette. On Library it searches titles first.',
      'More hubs Collections, Wishlist, Ownership, Big Picture, and related tools.',
      'Account → API tokens for companion secrets (shown once). Paste the full gt_… string — hyphens/underscores inside are normal. Prefer HTTPS copy; on plain HTTP use Copy or select the secret field + Ctrl/⌘C.',
      'Cover → details: trailers, Cheats on RetroArch titles (.cht create/upload), Extras & DLC honesty, screenshots, download. Admins: ⋮ → Edit / Open path (companion reveal).',
      'Site down? Ask admin for /healthz, /readyz, or Ops → Services.',
    ],
  },
  {
    id: 'library',
    title: 'Library & signals',
    summary: 'Favorites, chips, tiles, trailers',
    items: [
      'Heart a cover; open Favorites from top nav.',
      'Library multi-select: checkbox / long-press / Shift+click → Select page · Favorite · Unfavorite · Add to wishlist · Play status · Refresh freshness / Refresh covers (More; librarian+ · max 20) · Clear; Esc clears. Batch toasts report updated/queued / skipped / failed counts.',
      'Kind chips: Games · Experiences · Emulators · Tools (multi-select → item_kind; none = all).',
      'Signals chips: UPDATE · OUT/~ · MISSING · NEW · RELEASE · LANG.',
      'MISSING tile badge (top-left) means files were removed from disk - tooltip explains. Filter with the MISSING Signals chip when available.',
      'Tile size: header or top-nav control. Preferences (sectioned: Library · Look · Language) → items per page (20–1000).',
      'Trailers empty state is normal without metadata. Details use embeds; YouTube demo when no trailers.',
      'Extras & DLC lists on-server sidecars only - missing folders stay off-server.',
      'When watch/scan adds titles, a short toast may appear (Notifications inbox keeps the row).',
    ],
  },
  {
    id: 'systems',
    title: 'Systems & themes',
    summary: 'Platform browse and accents',
    items: [
      'Systems tiles filter the library by console/PC.',
      'Badge chips include VR, UPDATE, OUT/~, MISSING, NEW, RELEASE, LANG (vs Preferences → Preferred game language).',
      'Inside a system, accents follow that family; global search keeps default glass.',
      'Export packs (bottom of Systems): ES-DE gamelist.xml and Pegasus metadata for other frontends — optional; paths stay portable.',
      'Change themes in Preferences; hard-refresh after apply so volume CSS loads.',
    ],
  },
  {
    id: 'downloads',
    title: 'Downloads',
    summary: 'Zip queue and retention',
    items: [
      'Download on a game page starts a server zip.',
      'Track progress under Downloads. Files stay until you or an admin remove them.',
    ],
  },
  {
    id: 'social',
    title: 'Social & voice',
    summary: 'Friends, chat, LiveKit',
    items: [
      'Friends pill or More → Friends: stay-open dock. Pop out uses /social-companion only.',
      'Chat pill / More → Chat / Ctrl+K → Chat: left slide-out room (channels · thread · composer with emoji/attach). Expand widens the panel. Voice & Screenshare in the thread header (LiveKit). Archive (creator/librarian) & Leave. Leave on a household room mutes it. /chat deep-links the same panel. No Discord bots/webhooks.',
      'More → Activity for presence and optional LiveKit. More → Notifications: dense unread inbox; alert prefs under Alert preferences.',
      'No Discord bots/webhooks — native chat, optional LiveKit, or BYO Stoat/Matrix.',
    ],
  },
  {
    id: 'updates-calendar',
    title: 'Updates & calendar',
    summary: 'Freshness inbox and release window',
    items: [
      'More → Updates: freshness inbox auto-refreshes while the tab is visible; use Refresh for an immediate pull. Search stores and apply packs stay as before (dense rows, less glass card clutter).',
      'Updates also teases upcoming releases; open the full Release calendar for List / Month / Agenda views (remembered in-browser) plus Ahead/Behind window controls.',
      'More → Calendar is IGDB metadata only (no downloads). Wishlist and Playtime use the same dense More-page rhythm (honest empty/error).',
    ],
  },
  {
    id: 'free-games',
    title: 'Free games',
    summary: 'News claims and ownership sync',
    items: [
      'News (All · Admins · Free now · Headlines) leads with a featured strip, then densified sections. Free claims live under Free now (and `#free-games`). Claim on the store; Sync ownership if linked.',
      'GameTheca never downloads DRM titles for you.',
      'Opt out under Notifications → Alert preferences.',
    ],
  },
  {
    id: 'translations',
    title: 'Translations & patches',
    summary: 'Locale chips and Flips',
    items: [
      'Preferred game language (default en-US) ≠ UI language.',
      'LANG / PATCH chips mark mismatches and curated extras. Apply with Flips; keep a ROM backup.',
      'AI overlay / patch catalog / companion apply only when the operator enables those flags.',
    ],
  },
  {
    id: 'cheats',
    title: 'Cheats (.cht)',
    summary: 'Details create / upload / play',
    items: [
      'Game details → Cheats (RetroArch titles only): New cheat (name + code rows + dialect hint) or upload a RetroArch .cht.',
      'Dialect labels are capability hints (Raw / GG-style / AR-style / GS-style); files always save as .cht.',
      'Browser play: open Play in browser, then pick the file from the play-bar cheat list. Quick Menu may still be needed to enable codes.',
      'Companion stages the same library .cht files before RetroArch; heavy cores prefer companion over the browser FS.',
      'PC / native titles (PCWIN, PCDOS, MAC, OTHER): the Cheats panel is hidden. No RetroArch list and no memory-cheat wand this wave.',
    ],
  },
  {
    id: 'browser-play',
    title: 'Browser play & BIOS',
    summary: 'Firmware honesty, extractors, missing paths',
    items: [
      'Some systems need BIOS/firmware on the host before Play in browser works. Details and tiles show a quiet blocker with the server hint - no Download BIOS button.',
      'Admins upload legally obtained firmware under Admin → Emulators (emulator BIOS), or mount a private host BIOS folder. GameTheca never ships copyrighted BIOS files.',
      'Compressed ROMs extract on play. Prefer .zip when possible; .rar/.7z need host tools. Failures show the server hint (missing extractor) in the play shell.',
      'If a version is Missing on disk, Download is hidden; a 410 path_missing response toasts the backend hint (remove missing versions or restore files).',
    ],
  },
  {
    id: 'controllers-vr',
    title: 'Controllers & VR',
    summary: 'Big Picture and headset browse',
    items: [
      'More → Big Picture: A open, X download, B Attract, Y Friends, Esc exit.',
      'VR browse (/vr) is headset-friendly for any seat — not Quest-only.',
      'VR badge sits in the top-left stack; Sense controllers do not drive the website.',
    ],
  },
  {
    id: 'support',
    title: 'Need help?',
    summary: 'Report issue and docs',
    items: [
      'More → Report issue: title required; symptom/logs optional. Context and Logs stay collapsed until expanded.',
      'Ask your admin for docs/user guides, or see the GitHub repo.',
    ],
  },
]

export function HelpPage() {
  const [openIds, setOpenIds] = useState(() => {
    const initial = new Set(['getting-started'])
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash && FAQ_SECTIONS.some((s) => s.id === hash)) {
        initial.add(hash)
      }
    }
    return initial
  })

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    if (!FAQ_SECTIONS.some((s) => s.id === hash)) return
    setOpenIds((current) => {
      if (current.has(hash)) return current
      const next = new Set(current)
      next.add(hash)
      return next
    })
    const el = document.getElementById(hash)
    el?.scrollIntoView?.({ block: 'start' })
  }, [])

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

  function expandAll() {
    setOpenIds(new Set(FAQ_SECTIONS.map((s) => s.id)))
  }

  function collapseAll() {
    setOpenIds(new Set())
  }

  return (
    <div className="gt-more-page gt-help">
      <div className="gt-page-header">
        <h1>Help</h1>
      </div>
      <p className="gt-more-page__lede">
        Short answers for the member library. Expand a section when you need detail.
      </p>

      <div className="gt-help__toolbar">
        <button type="button" className="gt-btn gt-btn--ghost" onClick={expandAll}>
          Expand all
        </button>
        <button type="button" className="gt-btn gt-btn--ghost" onClick={collapseAll}>
          Collapse all
        </button>
        <Link className="gt-help__support-link" to="/report">
          Report an issue
        </Link>
      </div>

      <div className="gt-help__toc" aria-label="Help topics">
        {FAQ_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="gt-help__toc-chip">
            {section.title}
          </a>
        ))}
      </div>

      <div className="gt-help__sections">
        {FAQ_SECTIONS.map((section) => {
          const open = openIds.has(section.id)
          return (
            <section
              key={section.id}
              id={section.id}
              className={`gt-help__section${open ? ' is-open' : ''}`}
            >
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(section.id)}
                >
                  <span className="gt-help__section-copy">
                    <span className="gt-help__section-title">{section.title}</span>
                    <span className="gt-help__section-summary">{section.summary}</span>
                  </span>
                  <span className="gt-help__chevron" aria-hidden="true">
                    {open ? '−' : '+'}
                  </span>
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

      <p className="gt-help__footer">
        Repo:{' '}
        <a href="https://github.com/chrisjrovira/gametheca" target="_blank" rel="noopener noreferrer">
          chrisjrovira/gametheca
        </a>
      </p>
    </div>
  )
}
