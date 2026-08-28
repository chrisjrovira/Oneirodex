import { useEffect, useState } from 'react'
import { ContextBar } from '../chrome/ContextBar'
import { RailIcon } from '../chrome/railIcons'
import './HelpPage.css'

/**
 * Twelve topics is a strip you scroll, not a switcher you read (W29 human
 * report: "help buttons are overflowing"). They collapse to five groups.
 *
 * Grouped rather than merged, deliberately. Merging the twelve into five
 * sections would have folded twelve headings and their summaries into five and
 * — worse — retired ten anchor ids that are linked from elsewhere in the
 * product: `playHonesty.js` sends a blocked Play straight to `/help#browser-play`.
 * Every section keeps its id, its heading and its own copy; only the switcher
 * is shorter, and a group jumps to the first section in it.
 *
 * `tone` is one of the five semantic colours the theme guarantees — accent,
 * info, success, warning, danger (see gt-tokens.css). It is not decoration for
 * its own sake: twelve identical grey panels give the eye nothing to navigate
 * by, so a section is found by re-reading every heading. Colour plus a glyph
 * makes "the one about downloads" findable at a glance, and taking both from
 * the token set means every theme and icon pack restyles them for free rather
 * than fighting a palette invented here.
 */
const FAQ_SECTIONS = [
  {
    id: 'getting-started',
    group: 'Start',
    icon: 'discover',
    tone: 'accent',
    title: 'Getting started',
    short: 'Start',
    summary: 'Nav, Cmd+K, details, health checks',
    items: [
      'Top nav: Discover, Library, Systems, Downloads, Favorites.',
      'Ctrl+K / ⌘K (or Search) opens the command palette. On Library it searches titles first.',
      'Discover shelves can be pinned or hidden per account (Rows in the top bar). A shelf with nothing honest to show is hidden rather than padded.',
      'On long scrollable pages, Jump to top / Jump to bottom controls appear bottom-left (hide when the page does not scroll).',
      'More hubs Collections, Wishlist, Ownership, Big Picture, and related tools.',
      'Ownership registers Steam / GOG / Epic / Amazon titles you already own. Live sync when a token is saved (GOG refresh token, Epic device-auth JSON, Amazon Nile/Heroic blob). Never a store download.',
      'Account → API tokens for companion secrets (shown once). Paste the full gt_… string — hyphens/underscores inside are normal. Prefer HTTPS copy; on plain HTTP use Copy or select the secret field + Ctrl/⌘C.',
      'Cover → details: trailers, Cheats on RetroArch titles (.cht create/upload), Extras & DLC honesty, multi-disc chips when the set has more than one disc, screenshots, download. Admins: ⋮ → Edit / Open path (companion reveal).',
      'Site down? Ask admin for /healthz, /readyz, or Ops → Services.',
    ],
  },
  {
    id: 'library',
    group: 'Collection',
    icon: 'library',
    tone: 'info',
    title: 'Library & signals',
    short: 'Library',
    summary: 'Favorites, chips, tiles, trailers',
    items: [
      'Heart a cover; open Favorites from top nav.',
      'One tile per title, not per copy. A game you hold on NES and SNES is one tile; Preview → Available on lists the other systems, and store / trailer marks (Steam / GOG / Epic / YouTube) when the title has them.',
      'A greyed-out Play button still opens: it explains why (missing BIOS, companion-only, catalog-only) instead of sitting dead.',
      'Library multi-select: checkbox / long-press / Shift+click → Select page · Favorite · Unfavorite · Add to wishlist · Play status · Refresh freshness / Refresh covers (More; librarian+ · max 20) · Clear; Esc clears. Batch toasts report updated/queued / skipped / failed counts.',
      'Kind chips: Games · Soft titles · Emulators · Utilities (multi-select → item_kind; none = all). Tile badges EXP / TOOL stay short; tooltips Soft title / Utility.',
      'Desktop filters: chevron collapses the aside to a slim rail so covers reclaim the width (preference saved); chevron again restores. Narrow screens still use the Filters drawer.',
      'Signals chips: UPDATE · MISSING · NEW · LANG.',
      'MISSING tile badge (top-left) means files were removed from disk - tooltip explains. Filter with the MISSING Signals chip when available.',
      'Tile size: header or top-nav control. Preferences (sectioned: Library · Look · Language) → items per page (20–1000).',
      'Trailers empty state is normal without metadata. Details use embeds; YouTube demo when no trailers.',
      'Extras & DLC lists on-server sidecars only - missing folders stay off-server.',
      'When watch/scan adds titles, a short toast may appear (Notifications inbox keeps the row).',
    ],
  },
  {
    id: 'systems',
    group: 'Collection',
    icon: 'systems',
    tone: 'warning',
    title: 'Systems & themes',
    short: 'Systems',
    summary: 'Platform browse and accents',
    items: [
      'Systems tiles filter the library by console/PC. Each tile carries a Browser / Companion / Catalog badge that matches what Play can actually do.',
      'Set completeness (after an admin uploads a No-Intro/Redump DAT) opens from a Systems tile into the missing list. Region, Systems, and Browse library sit in the top bar.',
      'Tile badges use four corners only (occupied corners; no empty reserved slots) with rounded-square chrome. Signals: VR, UPDATE, MISSING, NEW, LANG (vs Preferences → Preferred game language). No OUT/~ / RELEASE on tiles.',
      'Inside a system, accents follow that family; global search keeps default glass.',
      'Export packs (bottom of Systems): ES-DE gamelist.xml and Pegasus metadata for other frontends — optional; paths stay portable.',
      'Change themes in Preferences — decade rooms (the place you started) and colour cabinets. Member and admin chrome share the same room scenery as browser play. Theme, icon pack, font and tile size save together. Preferences is the only place a theme is chosen. The change is visible on a normal reload; no hard refresh.',
    ],
  },
  {
    id: 'downloads',
    group: 'Collection',
    icon: 'downloads',
    tone: 'info',
    title: 'Downloads',
    short: 'Downloads',
    summary: 'Zip queue and retention',
    items: [
      'Download on a game page starts a server zip.',
      'Track progress under Downloads. Files stay until you or an admin remove them.',
    ],
  },
  {
    id: 'social',
    group: 'Community',
    icon: 'friends',
    tone: 'success',
    title: 'Social & voice',
    short: 'Social',
    summary: 'Friends, chat, LiveKit',
    items: [
      'Friends pill or More → Friends: stay-open dock. Pop out uses /social-companion only.',
      'Chat pill / More → Chat / Ctrl+K → Chat: left slide-out room (channels · thread · composer with emoji/attach). Expand widens the panel. Voice & Screenshare in the thread header (LiveKit). Archive (creator/librarian) & Leave. Leave on a household room mutes it. /chat deep-links the same panel. No Discord bots/webhooks.',
      'Spaces (the rail left of chat): household space is everyone; invite-only spaces are invisible until you redeem a code. Text and voice channels live under a space — not a Discord bot.',
      'More → Activity for presence and optional LiveKit. More → Notifications: dense unread inbox; alert prefs under Alert preferences.',
      'No Discord bots/webhooks — native chat, optional LiveKit, or BYO Stoat/Matrix.',
    ],
  },
  {
    id: 'updates-calendar',
    group: 'Collection',
    icon: 'calendar',
    tone: 'warning',
    title: 'Updates & calendar',
    short: 'Updates',
    summary: 'Freshness inbox and release window',
    items: [
      'More → Updates: freshness inbox auto-refreshes while the tab is visible; use Refresh for an immediate pull. Search stores and apply packs stay as before (dense rows, less glass card clutter).',
      'Updates also teases upcoming releases; open the full Release calendar for List or Month views (remembered in-browser) plus Ahead/Behind window controls. Month shows each day’s cover art and cycles through them when more than one title lands that day.',
      'More → Calendar is IGDB metadata only (no downloads). Wishlist and Playtime use the same dense More-page rhythm (honest empty/error). Playtime totals sit in the top bar.',
    ],
  },
  {
    id: 'free-games',
    group: 'Community',
    icon: 'news',
    tone: 'success',
    title: 'Free games',
    short: 'Free games',
    summary: 'News claims and ownership sync',
    items: [
      'News (All · Admins · Free now · Headlines) leads with a featured strip, then densified sections. Free claims live under Free now (and `#free-games`). Claim on the store; Sync ownership if linked (Steam / GOG / Epic / Amazon live when a token is saved).',
      'Oneirodex never downloads DRM titles for you.',
      'Opt out under Notifications → Alert preferences.',
    ],
  },
  {
    id: 'translations',
    group: 'Playing',
    icon: 'content',
    tone: 'info',
    title: 'Translations & patches',
    short: 'Patches',
    summary: 'Locale chips and Flips',
    items: [
      'Preferred game language (default en-US) ≠ UI language.',
      'LANG / PATCH chips mark mismatches and curated extras. Apply with Flips; keep a ROM backup.',
      'AI overlay / patch catalog / companion apply only when the operator enables those flags.',
    ],
  },
  {
    id: 'cheats',
    group: 'Playing',
    icon: 'integrations',
    tone: 'warning',
    title: 'Cheats (.cht)',
    short: 'Cheats',
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
    group: 'Playing',
    icon: 'big-picture',
    tone: 'danger',
    title: 'Browser play & BIOS',
    short: 'Play',
    summary: 'Firmware honesty, extractors, missing paths',
    items: [
      'Some systems need BIOS/firmware on the host before Play in browser works. Details and tiles show a quiet blocker with the server hint - no Download BIOS button.',
      'Admins upload legally obtained firmware under Admin → Emulators, scan a folder of dumps they already hold, or mount a private host BIOS folder. Oneirodex never ships or downloads copyrighted BIOS files.',
      'Browser Play covers NES, SNES, N64, Game Boy family, DS, Virtual Boy, PS1, Genesis family (including SG-1000), Saturn, Atari line, Lynx, Jaguar, WonderSwan, Neo Geo Pocket / Color, Coleco, Vectrex, 3DO, Neo Geo CD, Intellivision, Channel F, and Odyssey 2 — when the operator has provisioned that core. GameCube / Wii / Dreamcast / 3DS / PS2 / Vita play on the desktop companion. PS5 and Xbox Series stay catalog-only. No fake Play button for a core that is not there.',
      'Rewind stays off on heavy cores (N64, PS1, Saturn, Dreamcast, PSP). Picture cycles CRT · Sharp · Soft. Audio is clocked to the emulated system; the player measures your display refresh so 120/144Hz monitors do not run fast.',
      'Compressed ROMs extract on play. Prefer .zip when possible; .rar/.7z need host tools. Failures show the server hint (missing extractor) in the play shell.',
      'The play bar has Pause, Reset, Mute, volume, Save, Load, Rewind, FF, Picture, and Power (Power leaves the game, same as ← Library). ? opens shortcuts (F2/F3 save/load, hold Right Shift to rewind, F5 fast-forward). An overlay repeats the in-game controls on touch; on a mouse it appears when you move over the play stage.',
      'If a version is Missing on disk, Download is hidden; a 410 path_missing response toasts the backend hint (remove missing versions or restore files).',
    ],
  },
  {
    id: 'controllers-vr',
    group: 'Playing',
    icon: 'vr',
    tone: 'accent',
    title: 'Controllers & VR',
    short: 'Controllers',
    summary: 'Big Picture and headset browse',
    items: [
      'More → Big Picture: A open, X download, B Attract, Y Friends, Esc exit.',
      'VR browse (/vr) is headset-friendly for any seat — not Quest-only.',
      'VR badge sits in the top-left stack; Sense controllers do not drive the website.',
    ],
  },
  {
    id: 'support',
    group: 'Support',
    icon: 'report',
    tone: 'danger',
    title: 'Need help?',
    short: 'Support',
    summary: 'Report and docs',
    items: [
      'More → Report: choose whether something is broken or you have an idea, then a title. Symptom and logs are optional; Context and Logs stay collapsed until expanded.',
      'Ask your admin for docs/user guides, or see the GitHub repo.',
    ],
  },
  {
    // AGPL §13 requires that people using this *over a network* be offered the
    // Corresponding Source "through some standard or customary means". The
    // README said so; nothing in the running app did. This section is where the
    // obligation is actually discharged, which is why the source link is
    // rendered from shellConfig rather than hardcoded — a modified deployment
    // owes its users its own source.
    //
    // It also carries provider attribution: IGDB (Twitch), Giant Bomb and
    // SteamGridDB each ask for it in their API terms, and the member app
    // surfaced their data with none.
    id: 'about',
    group: 'Support',
    icon: 'report',
    tone: 'info',
    title: 'About & licence',
    short: 'About',
    summary: 'Source code, licence, data credits',
    items: [
      'Oneirodex (oh-NY-roh-dex) is free software under the GNU Affero General Public License v3.0. You may run, study, modify and share it.',
      'Running a modified copy as a network service? AGPL §13 means you owe your users that modified source. Admins set GT_SOURCE_URL to point here at their own fork.',
      'The licence covers Oneirodex itself — not the games, ROMs, BIOS or artwork you point it at. The Python package, Docker image, and GitHub repo still use gametheca until the identifier wave.',
      'Game metadata and artwork come from IGDB (an Amazon company), Giant Bomb, SteamGridDB and store pages, depending on what your admin configured.',
      'Browser play uses WebRetro with libretro emulator cores, provisioned by your admin rather than shipped with Oneirodex.',
    ],
    links: [
      { key: 'source', label: 'Source code (AGPL §13)', href: null, fromConfig: 'sourceUrl' },
      { key: 'licence', label: 'GNU AGPL v3.0', href: 'https://www.gnu.org/licenses/agpl-3.0.html' },
      { key: 'igdb', label: 'IGDB', href: 'https://www.igdb.com/' },
      { key: 'giantbomb', label: 'Giant Bomb', href: 'https://www.giantbomb.com/' },
      { key: 'steamgriddb', label: 'SteamGridDB', href: 'https://www.steamgriddb.com/' },
    ],
  },
]

/**
 * The switcher's five entries, derived from the sections rather than declared
 * beside them — a group listed here that no section belongs to would render an
 * empty destination, and a section whose group nobody listed would become
 * unreachable. Order follows first appearance, so it matches reading order
 * down the page.
 */
const FAQ_GROUPS = FAQ_SECTIONS.reduce((groups, section) => {
  if (!groups.some((group) => group.id === section.group)) {
    groups.push({ id: section.group, label: section.group })
  }
  return groups
}, [])


export function HelpPage({ shellConfig = {} }) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const groupOf = (sectionId) =>
    FAQ_SECTIONS.find((section) => section.id === sectionId)?.group || FAQ_GROUPS[0].id

  const firstSectionOfGroup = (groupId) =>
    FAQ_SECTIONS.find((section) => section.group === groupId)?.id || FAQ_SECTIONS[0].id

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
    setActiveSection(hash)
    const el = document.getElementById(hash)
    el?.scrollIntoView?.({ block: 'start' })
  }, [])

  // Which topic the strip marks as current. Set by using the strip, and by an
  // arriving hash, rather than tracked by scroll position: this is a list of
  // accordions, so "where am I" is decided by the one you opened, not by which
  // few pixels happen to be under the viewport's midpoint.
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === 'undefined') return FAQ_SECTIONS[0].id
    const hash = window.location.hash.replace(/^#/, '')
    return FAQ_SECTIONS.some((s) => s.id === hash) ? hash : FAQ_SECTIONS[0].id
  })

  function jumpToSection(id) {
    if (!FAQ_SECTIONS.some((section) => section.id === id)) return
    setActiveSection(id)
    // Opened as well as scrolled to: jumping to a collapsed section would put
    // its heading under the bar and show nothing underneath it.
    setOpenIds((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
    document.getElementById(id)?.scrollIntoView?.({ block: 'start' })
  }

  function toggle(id) {
    // Decide from the current value *outside* the updater: a state updater has
    // to be pure, and React may replay it (it does so deliberately in
    // StrictMode), so calling setActiveSection from inside one fires it twice
    // and reads a value the queue may already have moved past.
    const opening = !openIds.has(id)
    if (opening) {
      setActiveSection(id)
    }
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
    <>
    {useNewChrome ? (
        <ContextBar
          /* The topic list *is* the page's navigation, so it belongs in bar
             two with every other page's views. It used to sit inside the
             content, which meant scrolling the page to reach the control that
             jumps around the page. Labels are the short forms — the full
             heading is still on the section itself. */
          views={FAQ_GROUPS.map((group) => ({
            id: group.id,
            label: group.label,
          }))}
          activeView={groupOf(activeSection)}
          onSelectView={(groupId) => jumpToSection(firstSectionOfGroup(groupId))}
          summary={`${openIds.size} of ${FAQ_SECTIONS.length} open`}
          actions={
            /* Expand first, collapse second — opposite ends of one range.
               W28 separated them with a "Report an issue" link, on the argument
               that sitting them side by side makes a mis-click cost the whole
               page's state. That link is gone: Report is a rail destination and
               a second route to it belongs on a page about finding things even
               less than the adjacency hurts. The adjacency is real and is
               logged in the debt log rather than solved with an unrelated
               control standing in as a spacer. */
            <>
              <button type="button" className="gt-cbtn" onClick={expandAll}>
                Expand all
              </button>
              <button type="button" className="gt-cbtn" onClick={collapseAll}>
                Collapse all
              </button>
            </>
          }
        />
      ) : null}
    <div className="gt-more-page gt-help">
      {/* Not `gt-page-header`: that block is deliberately collapsed under the
          v2 chrome because the bar already names the page. Help is the one page
          where the name is not the point — a member arrives here stuck, and the
          first thing on screen should say what this page can do for them and
          how it is organised. So it is its own banner, and it says something the
          bar does not. */}
      {useNewChrome ? (
      <header className="gt-help__hero">
        <span className="gt-help__hero-mark" aria-hidden="true">
          <RailIcon name="help" size={26} />
        </span>
        <div className="gt-help__hero-copy">
          <h1 className="gt-help__hero-title">How Oneirodex works</h1>
          <p className="gt-help__hero-lede">
            Twelve short sections, colour-coded by topic. Open one for detail, or
            use Expand all in the bar above to read straight through.
          </p>
        </div>
      </header>
      ) : null}
      {useNewChrome ? null : (
        <>
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
          </div>
        </>
      )}

      {/* The topic strip lives in bar two under the new chrome; rendering it
          here as well would be the same control twice on one screen. Classic
          chrome still needs it in the page, because there is no bar to put it
          in.

          One control, not a scatter of pills: these were separate bordered
          chips that wrapped into two or three ragged rows. `gt-seg` is the
          shared segmented control the context bar and the admin tab strips
          already use. The tone and glyph come from the section itself, so a
          topic is findable at a glance rather than by re-reading headings. */}
      {useNewChrome ? null : (
        <nav className="gt-seg gt-help__toc" aria-label="Help topics">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="gt-seg__item gt-help__toc-chip"
              data-tone={section.tone}
            >
              <span className="gt-help__toc-mark" aria-hidden="true">
                <RailIcon name={section.icon} size={14} />
              </span>
              {section.title}
            </a>
          ))}
        </nav>
      )}

      <div className="gt-help__sections">
        {FAQ_SECTIONS.map((section) => {
          const open = openIds.has(section.id)
          return (
            <section
              key={section.id}
              id={section.id}
              data-tone={section.tone}
              className={`gt-help__section${open ? ' is-open' : ''}`}
            >
              <h2>
                <button
                  type="button"
                  className="gt-help__section-toggle"
                  aria-expanded={open}
                  onClick={() => toggle(section.id)}
                >
                  <span className="gt-help__section-mark" aria-hidden="true">
                    <RailIcon name={section.icon} size={18} />
                  </span>
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
                <>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {section.links ? (
                    <p className="gt-help__links">
                      {section.links
                        // A link whose href comes from config is dropped when
                        // that config is empty rather than rendered dead — an
                        // offer of source that goes nowhere is worse than none.
                        .map((link) => ({
                          ...link,
                          href: link.fromConfig ? shellConfig[link.fromConfig] : link.href,
                        }))
                        .filter((link) => link.href)
                        .map((link) => (
                          <a
                            key={link.key}
                            className="gt-help__link"
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.label}
                          </a>
                        ))}
                    </p>
                  ) : null}
                </>
              ) : null}
            </section>
          )
        })}
      </div>

      {/* The source offer, on every render of this page rather than only inside
          the About section — AGPL §13 wants it reachable, not hunted for. The
          URL is configuration: a modified deployment must point at its own. */}
      {shellConfig.sourceUrl ? (
        <p className="gt-help__footer">
          Oneirodex{shellConfig.appVersion ? ` ${shellConfig.appVersion}` : ''} — free software under
          the{' '}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            GNU AGPL v3.0
          </a>
          .{' '}
          <a href={shellConfig.sourceUrl} target="_blank" rel="noopener noreferrer">
            Get the source code
          </a>
          .
        </p>
      ) : null}
    </div>
    </>
  )
}
