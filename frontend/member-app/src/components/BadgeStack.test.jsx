import { render, screen } from '@testing-library/react'
import { BadgeStack } from './BadgeStack'
import { collectBadgeSignals, resolveBadgeCorner, capBadges } from '../utils/badgeSignals'

const now = new Date('2026-07-23T12:00:00Z')

test('resolveBadgeCorner shifts on title collision', () => {
  expect(resolveBadgeCorner('bottom-left', false)).toBe('bottom-left')
  expect(resolveBadgeCorner('bottom-left', true)).toBe('bottom-right')
  expect(resolveBadgeCorner('bottom-right', true)).toBe('top-left')
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

test('capBadges collapses overflow', () => {
  const { visible, overflow } = capBadges(
    [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }, { kind: 'd' }],
    3,
  )
  expect(visible).toHaveLength(3)
  expect(overflow).toBe(1)
})

test('BadgeStack renders bottom-right NEW fixture by default', () => {
  render(
    <BadgeStack
      game={{ date_identified: '2026-07-20T00:00:00Z', name: 'Fixture' }}
      now={now}
    />,
  )
  const stack = screen.getByLabelText(/game badges/i)
  expect(stack).toHaveAttribute('data-corner', 'bottom-right')
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
  expect(screen.getByLabelText(/game badges/i)).toHaveAttribute('data-corner', 'top-left')
})
