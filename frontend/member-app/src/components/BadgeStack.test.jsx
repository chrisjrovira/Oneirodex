import { render, screen } from '@testing-library/react'
import { BadgeStack } from './BadgeStack'
import {
  collectBadgeSignals,
  isPathMissing,
  resolveBadgeCorner,
  layoutBadgesByCorner,
  capBadges,
} from '../utils/badgeSignals'
import { dismissBadge, filterDismissedBadges } from '../utils/badgeDismiss'

const now = new Date('2026-07-23T12:00:00Z')

function badgeLayers() {
  return screen.getByLabelText(/game badges/i)
}

function cornerStack(corner) {
  return badgeLayers().querySelector(`[data-corner="${corner}"]`)
}

test('collectBadgeSignals includes EXP/EMU/TOOL for non-game kinds', () => {
  expect(
    collectBadgeSignals({ item_kind: 'experience' }, { now }).map((b) => b.kind),
  ).toEqual(['EXP'])
  expect(
    collectBadgeSignals({ content_kind: 'emulator' }, { now }).map((b) => b.kind),
  ).toEqual(['EMU'])
  expect(collectBadgeSignals({ item_kind: 'tool' }, { now }).map((b) => b.kind)).toEqual([
    'TOOL',
  ])
  expect(collectBadgeSignals({ item_kind: 'game' }, { now })).toEqual([])
})

test('BadgeStack renders EMU badge for emulator kind', () => {
  render(
    <BadgeStack
      game={{ item_kind: 'emulator', name: 'Emulator Fixture' }}
      now={now}
    />,
  )
  expect(screen.getByTitle(/emulator/i)).toHaveTextContent('EMU')
})

test('resolveBadgeCorner prefers top-left and shifts on title collision', () => {
  expect(resolveBadgeCorner('top-left', false)).toBe('top-left')
  expect(resolveBadgeCorner('top-left', true)).toBe('bottom-left')
  // hamburger + favorite stack together in top-right, so bottom-right is
  // tried before top-right when cascading away from a collision.
  expect(resolveBadgeCorner('bottom-left', true)).toBe('bottom-right')
  expect(resolveBadgeCorner('bottom-right', true)).toBe('top-right')
})

test('resolveBadgeCorner keeps VR top-left and skips platform chip corner', () => {
  expect(resolveBadgeCorner('top-left', true, { hasVr: true })).toBe('top-left')
  expect(resolveBadgeCorner('top-left', true, { hasPlatformChip: true })).toBe('bottom-right')
  expect(resolveBadgeCorner('bottom-left', false, { hasPlatformChip: true })).toBe('top-left')
})

test('collectBadgeSignals orders NEW and freshness without OUT/~', () => {
  const badges = collectBadgeSignals(
    {
      date_identified: '2026-07-20T00:00:00Z',
      freshness_status: 'behind',
      is_vr: true,
      has_local_override: true,
    },
    { now },
  )
  expect(badges.map((b) => b.kind)).toEqual(['UPDATE', 'NEW', 'VR', 'L'])
  expect(badges.some((b) => b.kind === 'OUT' || b.kind === '~')).toBe(false)
})

test('collectBadgeSignals omits RELEASE and heuristic ~', () => {
  const badges = collectBadgeSignals(
    {
      first_release_date: '2026-07-10T00:00:00Z',
      freshness_status: 'heuristic_behind',
    },
    { now },
  )
  expect(badges.map((b) => b.kind)).toEqual([])
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

test('layoutBadgesByCorner omits empty corners and pins VR top-left', () => {
  const badges = collectBadgeSignals(
    {
      date_identified: '2026-07-20T00:00:00Z',
      needs_translation: true,
      is_vr: true,
      has_local_override: true,
    },
    { now },
  )
  const { corners, hasVr } = layoutBadgesByCorner(badges, { maxPerCorner: 2 })
  expect(hasVr).toBe(true)
  expect(corners.every((c) => c.badges.length > 0 || c.overflow > 0)).toBe(true)
  expect(corners.some((c) => c.corner === 'top-left')).toBe(true)
  const tl = corners.find((c) => c.corner === 'top-left')
  expect(tl.badges.some((b) => b.kind === 'VR')).toBe(true)
})

test('BadgeStack renders top-left NEW fixture by default', () => {
  render(
    <BadgeStack
      game={{ date_identified: '2026-07-20T00:00:00Z', name: 'Fixture' }}
      now={now}
    />,
  )
  expect(cornerStack('top-left')).toBeTruthy()
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
  expect(cornerStack('bottom-left')).toBeTruthy()
  expect(cornerStack('top-left')).toBeNull()
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

  const stack = cornerStack('top-left')
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

test('VR stays top-left even when title collides or platform chip is present', () => {
  render(
    <BadgeStack
      game={{ is_vr: true, name: 'VR Collide', date_identified: '2026-07-20T00:00:00Z' }}
      collidesWithTitle
      hasPlatformChip
      now={now}
    />,
  )
  const stack = cornerStack('top-left')
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-vr-in-stack', 'top-left')
})

test('VR-only stack still anchors top-left', () => {
  render(
    <BadgeStack game={{ is_vr: true, name: 'Headset Only' }} now={now} />,
  )
  const stack = cornerStack('top-left')
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-vr-in-stack', 'top-left')
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
})

test('isPathMissing accepts path_status and path_missing', () => {
  expect(isPathMissing({ path_status: 'missing' })).toBe(true)
  expect(isPathMissing({ path_missing: true })).toBe(true)
  expect(isPathMissing({ path_status: 'ok' })).toBe(false)
  expect(isPathMissing({ path_missing: false })).toBe(false)
  expect(isPathMissing({})).toBe(false)
})

test('BadgeStack renders MISSING when path is gone', () => {
  render(
    <BadgeStack
      game={{ path_status: 'missing', name: 'Gone Title', date_identified: '2026-07-20T00:00:00Z' }}
      now={now}
    />,
  )
  const stack = cornerStack('top-left')
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-missing-in-stack', 'top-left')
  expect(screen.getByTitle(/removed from disk/i)).toHaveTextContent('MISSING')
  expect(screen.getByTitle(/newly added/i)).toHaveTextContent('NEW')
  expect(stack.querySelector('[data-badge="MISSING"] .gt-badge__dismiss')).toBeNull()
})

test('BadgeStack omits MISSING when path is ok', () => {
  render(
    <BadgeStack game={{ path_status: 'ok', name: 'Present Title' }} now={now} />,
  )
  expect(screen.queryByTitle(/removed from disk/i)).toBeNull()
  expect(screen.queryByLabelText(/game badges/i)).toBeNull()
})

test('collectBadgeSignals includes MISSING ahead of NEW', () => {
  const badges = collectBadgeSignals(
    {
      path_missing: true,
      date_identified: '2026-07-20T00:00:00Z',
    },
    { now },
  )
  expect(badges.map((b) => b.kind)).toEqual(['MISSING', 'NEW'])
})
