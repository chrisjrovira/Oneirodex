import { useState } from 'react'

const FAQ_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      'Use the top navigation for Discover, Library, Systems, Downloads, and Favorites.',
      'Open More for Collections, Wishlist, Ownership, Big Picture, and other hubs.',
      'Press any key on Library to focus search, then filter by genre, platform, or release date.',
      'Click a cover to open game details, screenshots, and download options.',
    ],
  },
  {
    id: 'systems',
    title: 'Systems & themes',
    items: [
      'Open Systems to browse by console or PC; each tile filters the library to that platform.',
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
      'Adjust tile size from the control in the page header or top nav.',
      'Customize accent themes and display options in Preferences (account menu).',
    ],
  },
  {
    id: 'support',
    title: 'Need Help?',
    items: [
      'Report technical problems on the GitHub repo: https://github.com/chrisjrovira/gametheca',
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
