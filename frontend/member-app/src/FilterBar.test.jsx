import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar, LIBRARY_SEARCH_DEBOUNCE_MS, cleanFilters } from './components/FilterBar'

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

function clearFiltersVisibleFlag() {
  try {
    window.localStorage?.removeItem('gt.library.filtersVisible')
  } catch {
    /* jsdom / node without localStorage */
  }
}

beforeEach(() => {
  clearFiltersVisibleFlag()
})

afterEach(() => {
  vi.useRealTimers()
})

test('cleanFilters drops empty and zero rating', () => {
  expect(cleanFilters({ genre: 'Action', rating: '0', theme: '' })).toEqual({
    genre: 'Action',
  })
})

test('cleanFilters drops blank name search', () => {
  expect(cleanFilters({ name: '  ', genre: 'Action' })).toEqual({ genre: 'Action' })
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

test('typing in library search debounces name apply', async () => {
  const user = userEvent.setup()
  const onLiveSearch = vi.fn()
  const onApply = vi.fn()

  render(
    <FilterBar
      filters={{}}
      onApply={onApply}
      onLiveSearch={onLiveSearch}
      onClear={() => {}}
    />,
  )

  const input = screen.getByRole('searchbox', { name: /search library by title/i })
  await user.type(input, 'cel')
  expect(onLiveSearch).not.toHaveBeenCalled()

  await waitFor(
    () => {
      expect(onLiveSearch).toHaveBeenCalledWith({ name: 'cel' })
    },
    { timeout: LIBRARY_SEARCH_DEBOUNCE_MS + 1500 },
  )
  expect(onApply).not.toHaveBeenCalled()
})

test('clearing library search restores filters without name', async () => {
  const user = userEvent.setup()
  const onLiveSearch = vi.fn()

  render(
    <FilterBar
      filters={{ name: 'cel', genre: 'Action' }}
      onApply={() => {}}
      onLiveSearch={onLiveSearch}
      onClear={() => {}}
    />,
  )

  const input = screen.getByRole('searchbox', { name: /search library by title/i })
  expect(input).toHaveValue('cel')
  await user.clear(input)

  await waitFor(
    () => {
      expect(onLiveSearch).toHaveBeenCalledWith({ genre: 'Action' })
    },
    { timeout: LIBRARY_SEARCH_DEBOUNCE_MS + 1500 },
  )
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

test('FilterBar Hide/Show filters persists and Kind/Signals sit above Apply', async () => {
  const user = userEvent.setup()
  clearFiltersVisibleFlag()

  const { container } = render(
    <FilterBar filters={{}} onApply={() => {}} onClear={() => {}} />,
  )

  const body = container.querySelector('#library-filters-body')
  expect(body).toBeTruthy()
  const kind = screen.getByRole('group', { name: 'Kind filters' })
  const signals = screen.getByRole('group', { name: 'Badge filters' })
  const apply = screen.getByRole('button', { name: 'Apply' })
  expect(
    kind.compareDocumentPosition(signals) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(
    signals.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Hide filters' }))
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Show filters' })).toBeInTheDocument()
  expect(window.localStorage?.getItem('gt.library.filtersVisible') ?? '0').toBe('0')
  // Title search stays visible when the rest of the filter body is collapsed
  expect(screen.getByRole('searchbox', { name: /search library by title/i })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Show filters' }))
  expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  expect(window.localStorage?.getItem('gt.library.filtersVisible') ?? '1').toBe('1')
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
