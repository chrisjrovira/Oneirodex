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
 * Cap flexible badges but always keep VR in the top-left transitional stack.
 */
function capWithPinnedVr(badges, maxVisible = 2) {
  const vr = badges.find((badge) => badge.kind === 'VR') || null
  const rest = badges.filter((badge) => badge.kind !== 'VR')
  const { visible: restVisible, overflow } = capBadges(rest, maxVisible)
  if (!vr) {
    return { visible: restVisible, overflow }
  }
  return { visible: [...restVisible, vr], overflow }
}

/**
 * Netflix/Roku-style overlay badge stack for title cards.
 * Default corner: top-left (hamburger + favorite now stack together in the
 * top-right band, one under the other).
 * VR joins the top-left transitional stack and is never dismissable.
 * Badges win top-left over the PLAY chip (PLAY is nudged in CSS when a stack is present).
 */
export function BadgeStack({
  game,
  preferredCorner = 'top-left',
  collidesWithTitle = false,
  hasPlatformChip = false,
  maxVisible = 2,
  now,
  dismissible = true,
}) {
  const [dismissTick, setDismissTick] = useState(0)
  const badges = useMemo(() => {
    void dismissTick
    return filterDismissedBadges(game?.uuid, collectBadgeSignals(game, { now }))
  }, [game, now, dismissTick])

  const { visible, overflow } = capWithPinnedVr(badges, maxVisible)
  const hasMain = visible.length > 0 || overflow > 0
  const dismissed = listDismissedKinds(game?.uuid).filter((kind) => kind !== 'VR')
  if (!hasMain && !(dismissible && dismissed.length > 0)) {
    return null
  }

  const hasVr = visible.some((badge) => badge.kind === 'VR')
  const corner = resolveBadgeCorner(preferredCorner, collidesWithTitle, {
    hasVr,
    hasPlatformChip: Boolean(hasPlatformChip),
  })

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
    <div
      className={`gt-badge-stack gt-badge-stack--${corner}${hasVr ? ' gt-badge-stack--vr' : ''}${dismissible ? ' gt-badge-stack--interactive' : ''}`}
      data-corner={corner}
      data-vr-in-stack={hasVr ? corner : undefined}
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
          {dismissible && badge.kind !== 'VR' ? (
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
