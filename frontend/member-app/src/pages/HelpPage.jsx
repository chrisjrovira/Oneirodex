import { useState } from 'react'

const FAQ_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      'Navigate through the library using the sidebar menu',
      'Press any key to start searching, to quickly find specific games',
      'Apply filters to narrow down your search by genre, platform, or release date',
      'Click on any game to view detailed information, screenshots, and download options',
    ],
  },
  {
    id: 'downloads',
    title: 'Downloads',
    items: [
      'Click the download button on any game page to start the download process',
      'Some downloads will require processing time as they are being zipped on the server',
      'Track your download progress in the Downloads section',
      'Downloaded files are available until you (or the admin) remove them from the list',
    ],
  },
  {
    id: 'library',
    title: 'Your Library',
    items: [
      'Add games to your favorites by clicking the heart icon',
      'Access your favorite games quickly from the sidebar',
      'View your download history in the Downloads section',
      'Customize your experience through the user preferences panel',
    ],
  },
  {
    id: 'support',
    title: 'Need Help?',
    items: [
      'If you need additional assistance or encounter any issues, report technical problems on the GitHub repo: https://github.com/chrisjrovira/gametheca',
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
      <p className="gt-more-page__lede">Your complete guide to using GameTheca</p>

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
                  {section.items.map((text) => (
                    <li key={text}>{text}</li>
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
