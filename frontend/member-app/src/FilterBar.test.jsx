import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar, cleanFilters } from './components/FilterBar'

vi.mock('./api/filters', () => ({
  fetchFilterOptions: () =>
    Promise.resolve({
      libraries: [],
      libraryPlatforms: [],
      igdbPlatforms: [],
      genres: [{ id: 1, name: 'Action' }],
      themes: [],
      gameModes: [],
      playerPerspectives: [],
    }),
}))

test('cleanFilters drops empty and zero rating', () => {
  expect(cleanFilters({ genre: 'Action', rating: '0', theme: '' })).toEqual({
    genre: 'Action',
  })
})

test('FilterBar uses aurora button classes', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()
  const onClear = vi.fn()

  render(<FilterBar filters={{}} onApply={onApply} onClear={onClear} />)

  const apply = await screen.findByRole('button', { name: 'Apply' })
  const clear = screen.getByRole('button', { name: 'Clear' })
  expect(apply.className).toContain('gt-btn')
  expect(apply.className).toContain('gt-btn--primary')
  expect(clear.className).toContain('gt-btn--secondary')
  expect(apply.className).not.toContain('btn-primary')
  expect(clear.className).not.toContain('btn-secondary')

  await user.click(apply)
  expect(onApply).toHaveBeenCalled()
})

test('FilterBar hosts signal chips in the filter section', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()

  render(<FilterBar filters={{}} onApply={onApply} onClear={() => {}} />)

  expect(screen.getByRole('group', { name: 'Badge filters' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'UPDATE' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'OUT/~' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'NEW' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'RELEASE' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'LANG' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'UPDATE' }))
  expect(onApply).toHaveBeenCalledWith({ has_updates: '1' })
})

test('FilterBar kind chips drive item_kind browse param', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()

  const { rerender } = render(
    <FilterBar filters={{}} onApply={onApply} onClear={() => {}} />,
  )

  expect(screen.getByRole('group', { name: 'Kind filters' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Games' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Experiences' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Emulators' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Games' }))
  expect(onApply).toHaveBeenCalledWith({ item_kind: 'game' })

  rerender(
    <FilterBar
      filters={{ item_kind: 'game' }}
      onApply={onApply}
      onClear={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Experiences' }))
  expect(onApply).toHaveBeenLastCalledWith({ item_kind: 'game,experience' })

  rerender(
    <FilterBar
      filters={{ item_kind: 'game,experience' }}
      onApply={onApply}
      onClear={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Games' }))
  expect(onApply).toHaveBeenLastCalledWith({ item_kind: 'experience' })

  rerender(
    <FilterBar
      filters={{ item_kind: 'experience' }}
      onApply={onApply}
      onClear={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Experiences' }))
  expect(onApply).toHaveBeenLastCalledWith({})
})
