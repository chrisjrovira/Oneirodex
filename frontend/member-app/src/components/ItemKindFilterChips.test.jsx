import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ITEM_KIND_FILTER_CHIPS,
  formatItemKindFilter,
  itemKindFromSearchParams,
  normalizeItemKindToken,
  parseItemKindFilter,
  toggleItemKindFilter,
  ItemKindFilterChips,
} from './ItemKindFilterChips'

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null),
  )
}

test('normalizeItemKindToken accepts plurals and emu alias', () => {
  expect(normalizeItemKindToken('Games')).toBe('game')
  expect(normalizeItemKindToken('experiences')).toBe('experience')
  expect(normalizeItemKindToken('emu')).toBe('emulator')
  expect(normalizeItemKindToken('TOOLS')).toBe('tool')
  expect(normalizeItemKindToken('nope')).toBeNull()
})

test('parseItemKindFilter and formatItemKindFilter map chip → browse param', () => {
  expect(parseItemKindFilter('')).toEqual([])
  expect(parseItemKindFilter('game,experience')).toEqual(['game', 'experience'])
  expect(parseItemKindFilter('tools,emu,games')).toEqual(['game', 'emulator', 'tool'])
  expect(formatItemKindFilter(['tool', 'game', 'tool'])).toBe('game,tool')
  expect(formatItemKindFilter([])).toBe('')
})

test('itemKindFromSearchParams reads item_kind and content_kind alias', () => {
  expect(itemKindFromSearchParams(new URLSearchParams('item_kind=game,experience'))).toEqual({
    item_kind: 'game,experience',
  })
  expect(itemKindFromSearchParams(new URLSearchParams('content_kind=emu'))).toEqual({
    item_kind: 'emulator',
  })
  expect(itemKindFromSearchParams(new URLSearchParams('genre=Action'))).toEqual({})
})

test('toggleItemKindFilter sets, multi-selects, and clears item_kind', () => {
  const applied = []
  toggleItemKindFilter({ sort_by: 'name' }, 'game', (next) => applied.push(next), cleanFilters)
  expect(applied[0]).toEqual({ sort_by: 'name', item_kind: 'game' })

  toggleItemKindFilter(applied[0], 'experience', (next) => applied.push(next), cleanFilters)
  expect(applied[1]).toEqual({ sort_by: 'name', item_kind: 'game,experience' })

  toggleItemKindFilter(applied[1], 'game', (next) => applied.push(next), cleanFilters)
  expect(applied[2]).toEqual({ sort_by: 'name', item_kind: 'experience' })

  toggleItemKindFilter(applied[2], 'experience', (next) => applied.push(next), cleanFilters)
  expect(applied[3]).toEqual({ sort_by: 'name' })
})

test('ItemKindFilterChips toggles Games then Experiences → comma param', async () => {
  const user = userEvent.setup()
  const applied = []
  const filters = { sort_by: 'name' }

  expect(ITEM_KIND_FILTER_CHIPS.map((c) => c.kind)).toEqual([
    'game',
    'experience',
    'emulator',
    'tool',
  ])

  const { rerender } = render(
    <ItemKindFilterChips
      filters={filters}
      onApply={(next) => applied.push(next)}
      cleanFilters={cleanFilters}
    />,
  )

  expect(screen.getByRole('group', { name: 'Kind filters' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Games' }))
  expect(applied[0]).toEqual({ sort_by: 'name', item_kind: 'game' })

  rerender(
    <ItemKindFilterChips
      filters={applied[0]}
      onApply={(next) => applied.push(next)}
      cleanFilters={cleanFilters}
    />,
  )
  expect(screen.getByRole('button', { name: 'Games' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Experiences' }))
  expect(applied[1]).toEqual({ sort_by: 'name', item_kind: 'game,experience' })
})
