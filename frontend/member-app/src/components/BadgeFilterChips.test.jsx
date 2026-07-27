import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  BadgeFilterChips,
  badgeFiltersFromSearchParams,
  BADGE_FILTER_PARAMS,
  toggleBadgeFilter,
} from './BadgeFilterChips'

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null),
  )
}

test('badgeFiltersFromSearchParams reads truthy chip params', () => {
  const params = new URLSearchParams('is_vr=1&has_updates=true&genre=Action')
  expect(badgeFiltersFromSearchParams(params)).toEqual({
    is_vr: '1',
    has_updates: '1',
  })
})

test('toggleBadgeFilter sets and clears param', () => {
  const applied = []
  toggleBadgeFilter({ sort_by: 'name' }, 'is_vr', (next) => applied.push(next), cleanFilters)
  expect(applied[0]).toEqual({ sort_by: 'name', is_vr: '1' })
  toggleBadgeFilter(applied[0], 'is_vr', (next) => applied.push(next), cleanFilters)
  expect(applied[1]).toEqual({ sort_by: 'name' })
})

test('BadgeFilterChips toggles VR and UPDATE', async () => {
  const user = userEvent.setup()
  const applied = []
  const filters = { sort_by: 'name' }

  const { rerender } = render(
    <BadgeFilterChips
      filters={filters}
      onApply={(next) => applied.push(next)}
      cleanFilters={cleanFilters}
    />,
  )

  expect(BADGE_FILTER_PARAMS).toContain('is_vr')
  expect(BADGE_FILTER_PARAMS).toContain('needs_translation')
  await user.click(screen.getByRole('button', { name: 'VR' }))
  expect(applied[0]).toEqual({ sort_by: 'name', is_vr: '1' })

  rerender(
    <BadgeFilterChips
      filters={applied[0]}
      onApply={(next) => applied.push(next)}
      cleanFilters={cleanFilters}
    />,
  )
  expect(screen.getByRole('button', { name: 'VR' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'UPDATE' }))
  expect(applied[1]).toEqual({ sort_by: 'name', is_vr: '1', has_updates: '1' })

  rerender(
    <BadgeFilterChips
      filters={applied[1]}
      onApply={(next) => applied.push(next)}
      cleanFilters={cleanFilters}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'LANG' }))
  expect(applied[2]).toEqual({
    sort_by: 'name',
    is_vr: '1',
    has_updates: '1',
    needs_translation: '1',
  })
})
