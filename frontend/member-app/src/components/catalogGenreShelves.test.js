import { describe, expect, test } from 'vitest'
import { SHELF_SIZE, shelfQuery } from './catalogGenreShelves'

describe('shelfQuery', () => {
  test('asks for one genre, one page', () => {
    // The whole point of Grid's rework: a shelf is a genre, not a slice of the
    // pager. If `page` or `per_page` ever came from the caller we would be
    // back to shelving whatever page 7 of 138 happened to contain.
    const query = shelfQuery({}, 'Strategy')
    expect(query).toEqual({ genre: 'Strategy', page: 1, per_page: SHELF_SIZE })
  })

  test('inherits the catalog bar filters so a shelf means what the page means', () => {
    const query = shelfQuery(
      { library_platform: 'NES', item_kind: 'game', name: 'mario' },
      'Platform',
    )
    expect(query.library_platform).toBe('NES')
    expect(query.item_kind).toBe('game')
    expect(query.name).toBe('mario')
    expect(query.genre).toBe('Platform')
  })

  test('drops the pager keys even when the caller passes a whole filter state', () => {
    const query = shelfQuery(
      { page: 7, per_page: 50, sort: 'name', library_platform: 'SNES' },
      'Puzzle',
    )
    expect(query.page).toBe(1)
    expect(query.per_page).toBe(SHELF_SIZE)
    expect(query.sort).toBeUndefined()
    expect(query.library_platform).toBe('SNES')
  })

  test('omits empty values rather than sending blank params', () => {
    const query = shelfQuery({ library_platform: '', item_kind: null, name: undefined }, 'RPG')
    expect('library_platform' in query).toBe(false)
    expect('item_kind' in query).toBe(false)
    expect('name' in query).toBe(false)
  })
})
