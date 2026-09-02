import { Link } from 'react-router-dom'
import './MorePage.css'
import './WaysToPlayPage.css'

const PLAY_PATHS = [
  {
    id: 'browser',
    to: '/library?play_mode=browser',
    title: 'Browser',
    body: 'Play here in this tab when a WebRetro core is actually installed.',
  },
  {
    id: 'companion',
    to: '/library?play_mode=companion',
    title: 'Companion',
    body: 'Launch on the desktop companion — honest when the browser cannot.',
  },
  {
    id: 'catalog',
    to: '/library?play_mode=catalog',
    title: 'Catalog',
    body: 'On the shelf only. No fake Play for systems this box cannot run.',
  },
]

export function WaysToPlayPage({ shellConfig = {} } = {}) {
  const enableVr = Boolean(shellConfig.enableVr)

  return (
    <div className="od-more-page od-ways-to-play">
      <p className="od-more-page__lede">
        Honest play paths for titles you already own — Browser, Companion, or
        Catalog. This is not a store verification badge. Systems still browse
        by console; VR is its own catalog when enabled.
      </p>

      <section className="od-systems-group">
        <h2 className="od-systems-group__title">Play paths</h2>
        <div className="od-ways-to-play__grid">
          {PLAY_PATHS.map((path) => (
            <Link key={path.id} className="od-ways-to-play__card" to={path.to}>
              <h3 className="od-ways-to-play__card-title">{path.title}</h3>
              <p className="od-ways-to-play__card-body">{path.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="od-systems-group">
        <h2 className="od-systems-group__title">Hubs</h2>
        <div className="od-ways-to-play__grid">
          <Link className="od-ways-to-play__card" to="/systems">
            <h3 className="od-ways-to-play__card-title">Systems</h3>
            <p className="od-ways-to-play__card-body">
              Browse by console or PC. Each tile already carries the same play-path badge.
            </p>
          </Link>
          {enableVr ? (
            <Link className="od-ways-to-play__card" to="/vr">
              <h3 className="od-ways-to-play__card-title">VR</h3>
              <p className="od-ways-to-play__card-body">
                Headset titles when VR browse is on. Still catalog honesty, not a store.
              </p>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default WaysToPlayPage
