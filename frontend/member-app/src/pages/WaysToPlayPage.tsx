import { Link } from 'react-router-dom'
import './MorePage.css'
import './WaysToPlayPage.css'
import { isThinSeat } from '../utils/seatMode'
import { useShellConfig } from '@oneirodex/ui'
import { VR_COMPAT_COPY } from '../components/VrWayToPlay'

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

export function WaysToPlayPage() {
  const shellConfig = useShellConfig()
  // TC-3: on a thin seat the companion card must say the launch happens elsewhere.
  const thinSeat = isThinSeat()
  const enableVr = Boolean(shellConfig.enableVr)

  return (
    <div className="od-more-page od-ways-to-play">
      <p className="od-more-page__lede">
        Honest play paths for titles you already own — Browser, Companion, or Catalog. This is not a
        store verification badge. Systems still browse by console; VR is its own catalog when
        enabled.
      </p>

      <section className="od-systems-group">
        <h2 className="od-systems-group__title">Play paths</h2>
        <div className="od-ways-to-play__grid">
          {PLAY_PATHS.map((path) => (
            <Link
              key={path.id}
              className="od-ways-to-play__card"
              to={path.to}
              data-seat={thinSeat && path.id === 'companion' ? 'thin' : undefined}
            >
              <h3 className="od-ways-to-play__card-title">{path.title}</h3>
              <p className="od-ways-to-play__card-body">
                {thinSeat && path.id === 'companion'
                  ? 'Launches on the desktop companion, not on this seat — this seat browses and chats.'
                  : path.body}
              </p>
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

      {enableVr ? (
        <section className="od-systems-group" aria-labelledby="ways-vr-heading">
          {/* Rider R3 / VR-L4b: the three honest answers to "how does this play in
              a headset". Catalogue and deep link only — an injector profile is
              named and linked, never shipped, installed or pointed at as a file. */}
          <h2 id="ways-vr-heading" className="od-systems-group__title">
            In a headset
          </h2>
          <div className="od-ways-to-play__grid">
            {(['native_vr', 'injector_profile', 'flat'] as const).map((value) => {
              const copy = VR_COMPAT_COPY[value]
              const to = copy.hubQuery
                ? `/vr?vr_compat=${copy.hubQuery}`
                : '/library?play_mode=companion'
              return (
                <Link key={value} className="od-ways-to-play__card" to={to} data-vr-compat={value}>
                  <h3 className="od-ways-to-play__card-title">{copy.label}</h3>
                  <p className="od-ways-to-play__card-body">{copy.body}</p>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default WaysToPlayPage
