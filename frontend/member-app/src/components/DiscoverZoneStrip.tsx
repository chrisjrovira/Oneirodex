import { Link } from 'react-router-dom'
import './DiscoverZoneStrip.css'

/**
 * The zone strip — Discover's named surfaces, above the feed.
 *
 * Twelve rows on one page is a scroll; the same rows split across a few named
 * destinations is somewhere a member can mean to go. The strip is the only way
 * into a zone, so it is the whole navigation model, but it is deliberately
 * *additive*: the full feed stays underneath it, and nothing here changes what
 * the feed shows. A member who ignores the strip loses nothing.
 *
 * `zones` arrives with the feed rather than from a fetch of its own. That is
 * not a micro-optimisation — the server derives it from the shelves it just
 * rendered, so the strip cannot offer a destination the page would not serve.
 * An earlier version fetched an index built from *resolved* rows and duly
 * advertised a zone whose own route then 404'd, because selection had dropped
 * the only row behind it.
 */
export function DiscoverZoneStrip({ zones = [] }: LooseProps) {
  // One zone is not a choice, so the strip does not appear for it — a single
  // destination holding the whole feed is the feed.
  if (zones.length < 2) return null

  return (
    <nav className="od-zone-strip" aria-label="Discover zones">
      {zones.map((zone) => (
        <Link
          key={zone.slug}
          className="od-btn od-btn--sm od-btn--pill od-zone-strip__link"
          to={zone.href || `/discover/zone/${zone.slug}`}
          title={zone.lede || undefined}
        >
          {zone.title}
        </Link>
      ))}
    </nav>
  )
}

export default DiscoverZoneStrip
