import { capBadges, collectBadgeSignals, resolveBadgeCorner } from '../utils/badgeSignals'

/**
 * Netflix/Roku-style overlay badge stack for title cards.
 * Default corner: bottom-left; shifts when collidesWithTitle is set.
 */
export function BadgeStack({
  game,
  preferredCorner = 'bottom-left',
  collidesWithTitle = false,
  maxVisible = 3,
  now,
}) {
  const badges = collectBadgeSignals(game, { now })
  const { visible, overflow } = capBadges(badges, maxVisible)
  if (visible.length === 0) {
    return null
  }

  const corner = resolveBadgeCorner(preferredCorner, collidesWithTitle)

  return (
    <div
      className={`gt-badge-stack gt-badge-stack--${corner}`}
      data-corner={corner}
      aria-label="Game badges"
    >
      {visible.map((badge) => (
        <span
          key={badge.kind}
          className={`gt-badge gt-badge--${badge.tone}`}
          data-badge={badge.kind}
          title={badge.title}
        >
          {badge.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="gt-badge gt-badge--overflow" title={`${overflow} more badges`}>
          +{overflow}
        </span>
      )}
    </div>
  )
}
