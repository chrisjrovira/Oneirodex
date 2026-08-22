import { beforeEach, describe, expect, test } from 'vitest'
import { loadPinnedShelves, orderShelves, togglePinnedShelf } from './discoverPins'

const KEY = 'gt.discover.pinned'

beforeEach(() => {
  window.localStorage.removeItem(KEY)
})

describe('pin storage', () => {
  test('toggles on and off, returning the list as it now stands', () => {
    expect(loadPinnedShelves()).toEqual([])
    expect(togglePinnedShelf('latest_games')).toEqual(['latest_games'])
    expect(loadPinnedShelves()).toEqual(['latest_games'])
    expect(togglePinnedShelf('latest_games')).toEqual([])
    expect(loadPinnedShelves()).toEqual([])
  })

  test('survives junk in storage rather than throwing on page load', () => {
    // A shelf order is not worth taking the page down for.
    window.localStorage.setItem(KEY, 'not json')
    expect(loadPinnedShelves()).toEqual([])
    window.localStorage.setItem(KEY, '{"nope":1}')
    expect(loadPinnedShelves()).toEqual([])
    window.localStorage.setItem(KEY, '["ok", 7, null]')
    expect(loadPinnedShelves()).toEqual(['ok'])
  })
})

describe('orderShelves', () => {
  const sections = [
    { identifier: 'libraries' },
    { identifier: 'latest_games' },
    { identifier: 'most_downloaded' },
    { identifier: 'highest_rated' },
  ]

  test('leaves the admin order alone when nothing is pinned', () => {
    expect(orderShelves(sections, []).map((s) => s.identifier)).toEqual([
      'libraries',
      'latest_games',
      'most_downloaded',
      'highest_rated',
    ])
  })

  test('pinned rise in pin order and the rest keep display order', () => {
    // A partition, not a sort: `display_order` is a deliberate arrangement and
    // a comparator that only knows "pinned" would be free to shuffle the rest.
    const ordered = orderShelves(sections, ['highest_rated', 'latest_games'])
    expect(ordered.map((s) => s.identifier)).toEqual([
      'highest_rated',
      'latest_games',
      'libraries',
      'most_downloaded',
    ])
  })

  test('a pinned id no shelf answers to is dropped, not rendered as a hole', () => {
    // Shelves come and go — an admin can hide one, and a storefront shelf
    // hides itself when empty. The stored pin outlives it.
    const ordered = orderShelves(sections, ['retired_shelf', 'latest_games'])
    expect(ordered.map((s) => s.identifier)).toEqual([
      'latest_games',
      'libraries',
      'most_downloaded',
      'highest_rated',
    ])
  })
})
