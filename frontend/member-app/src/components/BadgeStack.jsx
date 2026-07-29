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
 * Default corner: top-left (hamburger is top-right; favorite is bottom-right).
 * VR is always rendered separately over the system/console chip and is never dismissable.
 */
export function BadgeStack({
  game,
  preferredCorner = 'top-left',
  collidesWithTitle = false,
  maxVisible = 2,
  now,
  dismissible = true,
}) {
  const [dismissTick, setDismissTick] = useState(0)
  const { vrBadge, badges } = useMemo(() => {
    void dismissTick
    const all = collectBadgeSignals(game, { now })
    const vr = all.find((badge) => badge.kind === 'VR') || null
    const rest = filterDismissedBadges(
      game?.uuid,
      all.filter((badge) => badge.kind !== 'VR'),
    )
    return { vrBadge: vr, badges: rest }
  }, [game, now, dismissTick])

  const { visible, overflow } = capBadges(badges, maxVisible)
  const hasMain = visible.length > 0 || overflow > 0
  if (!hasMain && !vrBadge) {
    return null
  }

  const corner = resolveBadgeCorner(preferredCorner, collidesWithTitle)
  const dismissed = listDismissedKinds(game?.uuid).filter((kind) => kind !== 'VR')

  function handleDismiss(kind, event) {
    if (kind === 'VR') {
      return
    }
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
    <>
      {vrBadge ? (
        <div
          className="gt-badge-stack gt-badge-stack--vr gt-badge-stack--bottom-left"
          data-corner="bottom-left"
          data-vr-anchor="platform"
          aria-label="VR badge"
        >
          <span
            className={`gt-badge gt-badge--${vrBadge.tone}`}
            data-badge={vrBadge.kind}
            title={vrBadge.title}
          >
            <span className="gt-badge__label">{vrBadge.label}</span>
          </span>
        </div>
      ) : null}
      {hasMain || (dismissible && dismissed.length > 0) ? (
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
      ) : null}
    </>
  )
}
