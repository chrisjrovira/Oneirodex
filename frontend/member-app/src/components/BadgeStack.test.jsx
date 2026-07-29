import { render, screen } from '@testing-library/react'
import { BadgeStack } from './BadgeStack'
import { collectBadgeSignals, resolveBadgeCorner, capBadges } from '../utils/badgeSignals'
import { dismissBadge, filterDismissedBadges } from '../utils/badgeDismiss'

const now = new Date('2026-07-23T12:00:00Z')

test('resolveBadgeCorner prefers top-left and shifts on title collision', () => {
  expect(resolveBadgeCorner('top-left', false)).toBe('top-left')
  expect(resolveBadgeCorner('top-left', true)).toBe('bottom-left')
  expect(resolveBadgeCorner('bottom-left', true)).toBe('top-right')
})

test('collectBadgeSignals orders NEW and freshness', () => {
  const badges = collectBadgeSignals(
    {
      date_identified: '2026-07-20T00:00:00Z',
      freshness_status: 'behind',
      is_vr: true,
      has_local_override: true,
    },
    { now },
  )
  expect(badges.map((b) => b.kind)).toEqual(['UPDATE', 'OUT', 'NEW', 'VR', 'L'])
})

test('collectBadgeSignals includes LANG and PATCH', () => {
  const badges = collectBadgeSignals(
    {
      needs_translation: true,
      preferred_game_locale: 'en-US',
      rom_region: 'JPN',
      has_translation_patch: true,
    },
    { now },
  )
  expect(badges.map((b) => b.kind)).toEqual(['LANG', 'PATCH'])
  expect(badges[0].title).toMatch(/en-US/)
})

test('capBadges collapses overflow', () => {
  const { visible, overflow } = capBadges(
    [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }, { kind: 'd' }],
    2,
  )
  expect(visible).toHaveLength(2)
  expect(overflow).toBe(2)
})

test('BadgeStack renders top-left NEW fixture by default', () => {
  render(
    <BadgeStack
      game={{ date_identified: '2026-07-20T00:00:00Z', name: 'Fixture' }}
      now={now}
    />,
  )
  const stack = screen.getByLabelText(/game badges/i)
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(screen.getByTitle(/newly added/i)).toHaveTextContent('NEW')
})

test('BadgeStack shifts corner when title collides', () => {
  render(
    <BadgeStack
      game={{ date_identified: '2026-07-20T00:00:00Z' }}
      collidesWithTitle
      now={now}
    />,
  )
  expect(screen.getByLabelText(/game badges/i)).toHaveAttribute('data-corner', 'bottom-left')
})

test('VR badge joins top-left transitional stack and is not dismissable', () => {
  const uuid = '22222222-2222-4222-8222-222222222222'
  render(
    <BadgeStack
      game={{
        uuid,
        is_vr: true,
        has_local_override: true,
        date_identified: '2026-07-20T00:00:00Z',
        name: 'VR Fixture',
      }}
      now={now}
    />,
  )

  const stack = screen.getByLabelText(/game badges/i)
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-vr-in-stack', 'top-left')
  expect(stack.className).toMatch(/gt-badge-stack--top-left/)
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
  expect(screen.getByTitle(/newly added/i)).toHaveTextContent('NEW')
  expect(stack.querySelector('[data-badge="VR"] .gt-badge__dismiss')).toBeNull()
  expect(screen.getByRole('button', { name: /hide l badge/i })).toBeInTheDocument()
  expect(screen.queryByLabelText(/^vr badge$/i)).toBeNull()

  dismissBadge(uuid, 'VR')
  const filtered = filterDismissedBadges(uuid, [
    { kind: 'VR', label: 'VR' },
    { kind: 'L', label: 'L' },
  ])
  // Even if a stale dismiss store listed VR, filter always keeps it.
  expect(filtered.some((b) => b.kind === 'VR')).toBe(true)
  expect(filtered.map((b) => b.kind)).toContain('VR')
})

test('VR-only stack still anchors top-left', () => {
  render(
    <BadgeStack game={{ is_vr: true, name: 'Headset Only' }} now={now} />,
  )
  const stack = screen.getByLabelText(/game badges/i)
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-vr-in-stack', 'top-left')
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
})
