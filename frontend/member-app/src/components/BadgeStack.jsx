import { useMemo, useState } from 'react'
import {
  capBadges,
  collectBadgeSignals,
  resolveBadgeCorner,
} from '../utils/badgeSignals'
import {
  clearDismissedBadges,
  dismissBadge,
  filterDismissedBadges,
  listDismissedKinds,
} from '../utils/badgeDismiss'

/**
 * Netflix/Roku-style overlay badge stack for title cards.
 * Default corner: bottom-right (avoids platform chip); shifts when collidesWithTitle.
 * Per-badge dismiss is local-only (per browser). Bulk clear is ops/admin only — not shown here.
 */
export function BadgeStack({
  game,
  preferredCorner = 'bottom-right',
  collidesWithTitle = false,
  maxVisible = 2,
  now,
  dismissible = true,
}) {
  const [dismissTick, setDismissTick] = useState(0)
  const badges = useMemo(() => {
    void dismissTick
    const all = collectBadgeSignals(game, { now })
    return filterDismissedBadges(game?.uuid, all)
  }, [game, now, dismissTick])

  const { visible, overflow } = capBadges(badges, maxVisible)
  if (visible.length === 0 && overflow === 0) {
    return null
  }

  const corner = resolveBadgeCorner(preferredCorner, collidesWithTitle)
  const dismissed = listDismissedKinds(game?.uuid)

  function handleDismiss(kind, event) {
    event.preventDefault()
    event.stopPropagation()
    dismissBadge(game?.uuid, kind)
    setDismissTick((n) => n + 1)
  }

  function handleRestore(event) {
    event.preventDefault()
    event.stopPropagation()
    clearDismissedBadges(game?.uuid)
    setDismissTick((n) => n + 1)
  }

  return (
    <div
      className={`gt-badge-stack gt-badge-stack--${corner}${dismissible ? ' gt-badge-stack--interactive' : ''}`}
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
          <span className="gt-badge__label">{badge.label}</span>
          {dismissible ? (
            <button
              type="button"
              className="gt-badge__dismiss"
              aria-label={`Hide ${badge.label} badge`}
              title="Hide this badge"
              onClick={(event) => handleDismiss(badge.kind, event)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {overflow > 0 && (
        <span className="gt-badge gt-badge--overflow" title={`${overflow} more badges`}>
          +{overflow}
        </span>
      )}
      {dismissible && dismissed.length > 0 && visible.length === 0 ? (
        <button
          type="button"
          className="gt-badge gt-badge--restore"
          title="Restore hidden badges"
          aria-label="Restore badges"
          onClick={handleRestore}
        >
          Badges
        </button>
      ) : null}
    </div>
  )
}
