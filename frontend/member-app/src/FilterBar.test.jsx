import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as filtersApi from './api/filters'
import {
  FilterBar,
  FILTERS_VISIBLE_KEY,
  LIBRARY_SEARCH_DEBOUNCE_MS,
  LibraryFiltersCollapseToggle,
  cleanFilters,
  readFiltersVisible,
  writeFiltersVisible,
} from './components/FilterBar'

vi.mock('./api/filters', () => ({
  fetchFilterOptions: vi.fn(),
}))

const FILTER_OPTIONS = {
  libraries: [],
  libraryPlatforms: [],
  igdbPlatforms: [],
  genres: [{ id: 1, name: 'Action' }],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
}

function clearFiltersVisibleFlag() {
  try {
    window.localStorage?.removeItem(FILTERS_VISIBLE_KEY)
  } catch {
    /* jsdom / node without localStorage */
  }
}

beforeEach(() => {
  clearFiltersVisibleFlag()
  filtersApi.fetchFilterOptions.mockReset()
  filtersApi.fetchFilterOptions.mockResolvedValue(FILTER_OPTIONS)
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

test('read/writeFiltersVisible persist LHN collapse preference', () => {
  clearFiltersVisibleFlag()
  expect(readFiltersVisible()).toBe(true)
  writeFiltersVisible(false)
  expect(window.localStorage?.getItem(FILTERS_VISIBLE_KEY)).toBe('0')
  expect(readFiltersVisible()).toBe(false)
  writeFiltersVisible(true)
  expect(readFiltersVisible()).toBe(true)
})

/**
 * The point of this test has not changed: the filter actions must use the
 * product's shared button classes and not Bootstrap's.
 *
 * Which shared class did change. `.gt-btn` and `.gt-cbtn` were two button
 * languages with two geometries, and this panel additionally re-styled whatever
 * it was given from scratch in `libraryFilters.css` — which is why the filter
 * buttons never matched the bar they open from. The two classes resolve to one
 * shape now and the local override is gone, so the panel carries `.gt-cbtn`,
 * the same class the trigger beside it carries.
 */
test('FilterBar uses the shared bar button classes', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()
  const onClear = vi.fn()

  render(<FilterBar filters={{}} onApply={onApply} onClear={onClear} />)

  const apply = await screen.findByRole('button', { name: 'Apply' })
  const clear = screen.getByRole('button', { name: 'Clear' })
  expect(apply.className).toContain('gt-cbtn')
  expect(apply.className).toContain('gt-cbtn--primary')
  expect(clear.className).toContain('gt-cbtn')
  expect(apply.className).not.toContain('btn-primary')
  expect(clear.className).not.toContain('btn-secondary')

  // One merged control, not three adjacent buttons.
  expect(apply.parentElement?.className).toContain('gt-cbtn-group')
  expect(clear.parentElement).toBe(apply.parentElement)

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
  expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'OUT/~' })).toBeNull()
  expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'RELEASE' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Lang' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Update' }))
  expect(onApply).toHaveBeenCalledWith({ has_updates: '1' })
})

/**
 * Apply now *leads* the panel. This test asserted the opposite, deliberately,
 * so the reversal is worth stating.
 *
 * The old order put the actions at the foot, below every select and chip.
 * That reads fine on a short panel and fails on a real one: inside the popover
 * the form scrolls, so committing a filter meant scrolling back past everything
 * you had just set. Leading with Apply/Clear keeps them one movement from the
 * trigger at any panel height, and they are sticky so they stay reachable while
 * the body scrolls under them.
 *
 * Signals sit immediately under Apply/Clear as one fused compact row;
 * Kind stays in the scrollable body. The body still stays mounted.
 */
test('FilterBar leads with Apply; Signals under actions; Kind in body', async () => {
  const { container } = render(
    <FilterBar filters={{}} onApply={() => {}} onClear={() => {}} />,
  )

  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()

  const body = container.querySelector('#library-filters-body')
  expect(body).toBeTruthy()
  const kind = screen.getByRole('group', { name: 'Kind filters' })
  const signals = screen.getByRole('group', { name: 'Badge filters' })
  const apply = screen.getByRole('button', { name: 'Apply' })
  expect(
    apply.compareDocumentPosition(signals) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(
    signals.compareDocumentPosition(kind) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(body.contains(kind)).toBe(true)
  expect(body.contains(signals)).toBe(false)
  expect(screen.queryByRole('button', { name: 'Hide filters' })).toBeNull()
})

test('LibraryFiltersCollapseToggle reports expanded state', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()

  const { rerender } = render(
    <LibraryFiltersCollapseToggle
      collapsed={false}
      onToggle={onToggle}
      controlsId="filters-panel"
    />,
  )

  const hide = screen.getByRole('button', { name: 'Hide filters' })
  expect(hide).toHaveAttribute('aria-expanded', 'true')
  expect(hide).toHaveAttribute('aria-controls', 'filters-panel')
  await user.click(hide)
  expect(onToggle).toHaveBeenCalledTimes(1)

  rerender(
    <LibraryFiltersCollapseToggle
      collapsed
      onToggle={onToggle}
      controlsId="filters-panel"
    />,
  )
  const show = screen.getByRole('button', { name: 'Show filters' })
  expect(show).toHaveAttribute('aria-expanded', 'false')
})

test('FilterBar kind chips drive item_kind browse param', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()

  const { rerender } = render(
    <FilterBar filters={{}} onApply={onApply} onClear={() => {}} />,
  )

  expect(screen.getByRole('group', { name: 'Kind filters' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Games' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Soft titles' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Emulators' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Utilities' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Games' }))
  expect(onApply).toHaveBeenCalledWith({ item_kind: 'game' })

  rerender(
    <FilterBar
      filters={{ item_kind: 'game' }}
      onApply={onApply}
      onClear={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Soft titles' }))
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
  await user.click(screen.getByRole('button', { name: 'Soft titles' }))
  expect(onApply).toHaveBeenLastCalledWith({})
})

test('shows a page status when filter options fail to load', async () => {
  filtersApi.fetchFilterOptions.mockRejectedValue(new Error('bundle failed'))

  render(<FilterBar filters={{}} onApply={() => {}} onClear={() => {}} />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load filter options.',
  )
})
