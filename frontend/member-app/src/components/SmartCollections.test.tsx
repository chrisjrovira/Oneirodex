import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { SmartCollections } from './SmartCollections'

/**
 * A smart collection is a saved filter with a tile (INSP-29) — not a second
 * kind of shelf. These pin the two things that make it work: only flagged
 * rows appear, and the link carries the tree the library can actually read.
 */

const TREE = { op: 'or', nodes: [{ field: 'is_vr', value: true }] }

vi.mock('../api/savedFilters', () => ({
  fetchSavedFilters: vi.fn(async () => [
    { id: 1, name: 'Headset night', tree: TREE, is_collection: true, created: null, updated: null },
    {
      id: 2,
      name: 'Just a filter',
      tree: TREE,
      is_collection: false,
      created: null,
      updated: null,
    },
  ]),
}))

function renderPanel() {
  return render(
    <MemoryRouter>
      <SmartCollections />
    </MemoryRouter>,
  )
}

test('only saved filters that asked to be shelves appear', async () => {
  renderPanel()
  expect(await screen.findByText('Headset night')).toBeTruthy()
  expect(screen.queryByText('Just a filter')).toBeNull()
})

test('the link carries the tree, so the catalog opens already filtered', async () => {
  renderPanel()
  const link = await screen.findByRole('link', { name: /Headset night/ })

  // LibraryApp reads `filter_tree` off the URL; without it the page would open
  // showing everything and look like the collection simply held the library.
  const href = link.getAttribute('href') || ''
  expect(href.startsWith('/library?filter_tree=')).toBe(true)
  expect(JSON.parse(decodeURIComponent(href.split('filter_tree=')[1]))).toEqual(TREE)
})

test('a member with no smart collections gets no empty heading', async () => {
  const api = await import('../api/savedFilters')
  vi.mocked(api.fetchSavedFilters).mockResolvedValueOnce([])

  const { container } = renderPanel()
  // Nothing at all, rather than a section explaining a feature they have not
  // used yet.
  await vi.waitFor(() => expect(container.querySelector('.od-smart-collections')).toBeNull())
})

// --- the other half: the library has to read what the link carries ---------

test('the library reads filter_tree off the URL', async () => {
  const { filtersFromSearchParams } = await import('../libraryQueryParams')

  const params = new URLSearchParams(`filter_tree=${encodeURIComponent(JSON.stringify(TREE))}`)
  expect(filtersFromSearchParams(params).filter_tree).toBe(JSON.stringify(TREE))

  // Blank is not a filter — it would otherwise reach the server as an empty
  // tree and come back a 400 on a page nobody asked to filter.
  expect(filtersFromSearchParams(new URLSearchParams('filter_tree=')).filter_tree).toBeUndefined()
})
